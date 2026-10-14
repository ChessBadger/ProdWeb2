import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import export_history as history


def row(employee=1, pieces=400, date="2026-09-01"):
    return {"Employee": employee, "AccountName": "Example", "StoreName": "Store 1",
            "DateOfInv": date, "Expr1": 4, "Total_Ext_Qty": pieces,
            "PiecesPerHr": pieces / 4, "AVG_DELTA": None}


class HistoryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.repo = self.root / "website"
        self.repo.mkdir()
        self.archive = self.root / "private-history"
        self.source = self.root / "EmployeeProductionExport.xlsx"

    def tearDown(self):
        self.temp.cleanup()

    def ingest(self, rows, content):
        self.source.write_bytes(content)
        return history.archive_export(self.source, {"sheet": rows}, self.archive, self.repo)

    def test_overlap_revision_absence_and_old_duplicate(self):
        first = self.ingest([row(1), row(2)], b"first")
        second = self.ingest([row(1, 800), row(1, 800), row(3)], b"second")
        rows = second["payload"]["EmployeeProductionHistory"]
        self.assertEqual(len(rows), 3)
        by_id = {r["Employee"]: r for r in rows}
        self.assertEqual(by_id[1]["Total_Ext_Qty"], 800)
        self.assertEqual(by_id[1]["_history"]["revision"], 2)
        self.assertEqual(by_id[2]["_history"]["revision"], 1)
        self.assertEqual(second["payload"]["_meta"]["latestEmployeeIds"], ["1", "3"])
        self.assertIsNone(by_id[1]["AVG_DELTA"])
        again = self.ingest([row(1), row(2)], b"first")
        self.assertTrue(again["duplicate"])
        self.assertEqual(again["payload"], second["payload"])
        self.assertEqual(len(again["manifest"]["snapshots"]), 2)
        self.assertEqual(history.verify_archive(self.archive), 2)
        as_of = history.history_as_of(self.archive, second["snapshot"]["receivedAt"])
        self.assertEqual(as_of, first["payload"], "as-of lookup must not expose future revisions")
        self.assertEqual(history.history_as_of(self.archive, first["snapshot"]["receivedAt"])["EmployeeProductionHistory"], [])
        self.assertEqual((self.archive / first["snapshot"]["rawFile"]).read_bytes(), b"first")

    def test_backfill_preserves_roster_then_current_changes_it(self):
        self.ingest([row(1), row(2)], b"current-one")
        self.source.write_bytes(b"backfill")
        result = history.archive_export(self.source, [row(1, 900), row(3)], self.archive, self.repo, import_mode="historical_backfill")
        self.assertEqual(result['payload']['_meta']['latestEmployeeIds'], ['1', '2'])
        revised = next(r for r in result['payload']['EmployeeProductionHistory'] if r['Employee'] == 1)
        self.assertEqual(revised['_history']['revision'], 2)
        self.assertEqual(revised['_history']['previousSourceSha256'], history.sha256(b'current-one'))
        self.assertEqual(result['snapshot']['importMode'], 'historical_backfill')
        current = self.ingest([row(3)], b'current-two')
        self.assertEqual(current['payload']['_meta']['latestEmployeeIds'], ['3'])
        self.assertEqual(len(current['payload']['EmployeeProductionHistory']), 3)
        self.source.write_bytes(b'backfill')
        duplicate = history.archive_export(self.source, [row(1, 900), row(3)], self.archive, self.repo, import_mode='current')
        self.assertTrue(duplicate['duplicate'])
        self.assertTrue(duplicate['rosterReclassified'])
        self.assertEqual(duplicate['payload']['_meta']['latestEmployeeIds'], ['1', '3'])
        self.assertEqual(duplicate['payload']['EmployeeProductionHistory'], current['payload']['EmployeeProductionHistory'])

    def test_failed_commit_preserves_previous_history(self):
        first = self.ingest([row()], b"first")
        original = (self.archive / "manifest.json").read_bytes()
        with patch.object(history, "atomic_write", side_effect=OSError("disk full")):
            with self.assertRaises(OSError):
                self.ingest([row(1, 900)], b"second")
        self.assertEqual((self.archive / "manifest.json").read_bytes(), original)
        self.assertEqual(history.latest_payload(self.archive, history.load_manifest(self.archive)), first["payload"])
        retry = self.ingest([row(1, 900)], b"second")
        self.assertEqual(retry["payload"]["EmployeeProductionHistory"][0]["Total_Ext_Qty"], 900)

    def test_invalid_input_and_archive_location(self):
        for rows in ([], [row(), row(pieces=900)], [{"Employee": 1}]):
            with self.assertRaises(ValueError):
                self.ingest(rows, b"invalid")
        self.source.write_bytes(b"okay")
        with self.assertRaises(ValueError):
            history.archive_export(self.source, [row()], self.repo / "public" / "archive", self.repo)

    def test_corruption_and_lock_do_not_reset_history(self):
        result = self.ingest([row()], b"first")
        lock = self.archive / ".import.lock"
        lock.write_text("other import")
        with self.assertRaises(RuntimeError):
            self.ingest([row()], b"second")
        lock.unlink()
        effective = self.archive / result["snapshot"]["effectiveFile"]
        effective.write_bytes(b"damaged")
        with self.assertRaises(ValueError):
            self.ingest([row()], b"third")
        self.assertEqual(len(history.load_manifest(self.archive)["snapshots"]), 1)

    def test_import_publication_is_retryable_and_keeps_raw_private(self):
        import convert_xl_to_json as converter
        captured = (b"workbook", {"sheet": [row(), row(2)]})
        with patch.object(converter, "read_excel_payload", return_value=captured):
            with patch.object(converter, "atomic_write", side_effect=OSError("publication failed")):
                with self.assertRaises(OSError):
                    converter.import_production_export(self.source, self.repo, self.archive)
            self.assertEqual(history.verify_archive(self.archive), 1)
            self.assertFalse((self.repo / "EmployeeProductionExport.json").exists())
            result = converter.import_production_export(self.source, self.repo, self.archive)
        self.assertTrue(result["duplicate"])
        for directory in [self.repo, self.repo / "data", self.repo / "public/data", self.repo / "docs/data"]:
            payload = json.loads((directory / "EmployeeProductionHistory.json").read_text())
            self.assertEqual(len(payload["EmployeeProductionHistory"]), 2)
            self.assertIsNone(payload["EmployeeProductionHistory"][0]["AVG_DELTA"])
        self.assertFalse(list(self.repo.rglob("*.xlsx")))

    def test_archive_failure_prevents_all_derived_writes(self):
        import convert_xl_to_json as converter
        original = self.repo / "EmployeeProductionExport.json"
        original.write_text("original current file")
        with patch.object(converter, "read_excel_payload", return_value=(b"new", {"sheet": [row()]})):
            with patch.object(converter, "archive_export", side_effect=OSError("archive unavailable")):
                with patch.object(converter, "atomic_write") as writer:
                    with self.assertRaises(OSError):
                        converter.import_production_export(self.source, self.repo, self.archive)
                    writer.assert_not_called()
        self.assertEqual(original.read_text(), "original current file")


if __name__ == "__main__":
    unittest.main()

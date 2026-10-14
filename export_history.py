"""Local-only, append-only production export history. No network dependencies.

A committed manifest is the transaction boundary. A failed import never replaces
the previous effective history. Uncommitted orphan snapshot directories are safe
to retain; they are never read as committed history or silently overwritten.
"""
from contextlib import contextmanager
from datetime import datetime, timezone
import hashlib
import gzip
import json
import os
from pathlib import Path
import tempfile
import uuid

SCHEMA = 1


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def json_bytes(value) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2,
                       allow_nan=False, default=str) + "\n").encode("utf-8")


def atomic_write(path: Path, data: bytes):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=".writing-", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def default_archive_dir(repo: Path) -> Path:
    base = Path(os.environ.get("LOCALAPPDATA", Path.home() / ".local" / "share"))
    namespace = sha256(str(repo.resolve()).casefold().encode())[:12]
    return base / "EmployeePredictor" / "ExportHistory" / namespace


def validate_archive_dir(archive: Path, repo: Path):
    # Reject the whole repository, not just public/, so git/build cannot publish it.
    if archive.resolve().is_relative_to(repo.resolve()):
        raise ValueError("Raw archive must be outside the website repository.")


@contextmanager
def archive_lock(archive: Path):
    archive.mkdir(parents=True, exist_ok=True)
    path = archive / ".import.lock"
    try:
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError as exc:
        raise RuntimeError(f"Import already running, or interrupted lock needs review: {path}") from exc
    try:
        with os.fdopen(fd, "w") as stream:
            stream.write(f"pid={os.getpid()}\n")
        yield
    finally:
        path.unlink()


def read_checked(path: Path, expected: str):
    data = path.read_bytes()
    if sha256(data) != expected:
        raise ValueError(f"Archive integrity check failed: {path}")
    return data


def load_manifest(archive: Path):
    path = archive / "manifest.json"
    if not path.exists():
        # Do not interpret an archive with committed snapshots but a lost manifest
        # as a brand-new archive: that would silently discard retained history.
        if (archive / "snapshots").exists() and any((archive / "snapshots").iterdir()):
            raise ValueError("Archive snapshots exist without manifest; recover the manifest before importing.")
        return {"schemaVersion": SCHEMA, "snapshots": []}
    manifest = json.loads(path.read_text(encoding="utf-8"))
    if manifest.get("schemaVersion") != SCHEMA or not isinstance(manifest.get("snapshots"), list):
        raise ValueError("Unsupported or damaged archive manifest; existing history was not replaced.")
    return manifest


def latest_payload(archive: Path, manifest):
    if not manifest["snapshots"]:
        return {"EmployeeProductionHistory": [], "_meta": {}}
    entry = manifest["snapshots"][-1]
    data = read_checked(archive / entry["effectiveFile"], entry["effectiveSha256"])
    return json.loads(gzip.decompress(data) if entry["effectiveFile"].endswith(".gz") else data)


def export_rows(payload):
    if isinstance(payload, list):
        rows = payload
    elif isinstance(payload, dict):
        rows = [row for value in payload.values() if isinstance(value, list) for row in value]
    else:
        raise ValueError("Production export must contain employee records.")
    if not rows:
        raise ValueError("Empty production export rejected; history and active roster are unchanged.")
    return rows


def employee_id(value):
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return str(int(value)) if int(value) == value else str(value)
    return str(value or "").strip()


def row_key(row):
    date = str(row.get("DateOfInv") or "")[:10]
    datetime.strptime(date, "%Y-%m-%d")
    employee = employee_id(row.get("Employee"))
    account = str(row.get("AccountName") or row.get("Account") or "").strip().casefold()
    store = str(row.get("StoreName") or "").strip().casefold()
    if not all((employee, account, store)):
        raise ValueError("Production record lacks employee, account, store, or inventory date.")
    # Office and supervisor are attributes, not event identity. Type can be revised.
    return json.dumps([date, account, store, employee], ensure_ascii=False)


def archive_export(source: Path, payload, archive: Path, repo: Path, source_bytes=None, import_mode="current"):
    if import_mode not in {"current", "historical_backfill"}:
        raise ValueError("Import mode must be current or historical_backfill.")
    validate_archive_dir(archive, repo)
    source_bytes = source.read_bytes() if source_bytes is None else source_bytes
    source_hash = sha256(source_bytes)
    incoming = {}
    for row in export_rows(payload):
        clean = {key: value for key, value in row.items() if key != "_history"}
        key = row_key(clean)
        if key in incoming and json_bytes(incoming[key]) != json_bytes(clean):
            raise ValueError(f"Conflicting employee/job rows in one export; import stopped (key hash {sha256(key.encode())[:12]}).")
        incoming[key] = clean

    with archive_lock(archive):
        manifest = load_manifest(archive)
        current = latest_payload(archive, manifest)
        duplicate = next((entry for entry in manifest["snapshots"] if entry["sourceSha256"] == source_hash), None)
        if duplicate:
            read_checked(archive / duplicate["rawFile"], source_hash)
            active_ids = sorted({employee_id(row["Employee"]) for row in incoming.values()})
            if import_mode == "current" and duplicate.get("importMode") == "historical_backfill" and active_ids != current.get("_meta", {}).get("latestEmployeeIds"):
                # Explicit roster reclassification never reapplies old production rows or corrections.
                now = datetime.now(timezone.utc)
                stamp = now.isoformat(timespec="microseconds")
                snapshot_id = now.strftime("%Y%m%dT%H%M%S.%fZ") + "_roster_" + uuid.uuid4().hex[:8]
                directory = archive / "snapshots" / snapshot_id
                directory.mkdir(parents=True, exist_ok=False)
                result = {**current, "_meta": {**current["_meta"], "importedAt": stamp, "snapshotId": snapshot_id,
                          "snapshotCount": len(manifest["snapshots"]) + 1, "latestEmployeeIds": active_ids,
                          "latestImportMode": "current", "rosterSourceSha256": source_hash,
                          "rosterPolicy": "explicit current-mode reclassification; production revisions unchanged"}}
                effective_bytes = gzip.compress(json_bytes(result), mtime=0)
                with (directory / "effective.json.gz").open("xb") as stream:
                    stream.write(effective_bytes); stream.flush(); os.fsync(stream.fileno())
                entry = {**duplicate, "id": snapshot_id, "receivedAt": stamp, "importMode": "current",
                         "activeEmployeeCount": len(active_ids), "effectiveFile": str((directory / "effective.json.gz").relative_to(archive)),
                         "effectiveSha256": sha256(effective_bytes), "newRows": 0, "revisedRows": 0,
                         "sourceName": source.name, "effectiveRows": len(current["EmployeeProductionHistory"]),
                         "incomingRows": len(incoming), "retainedAbsentRows": len({row_key(row) for row in current["EmployeeProductionHistory"]} - set(incoming)),
                         "rosterReclassified": True, "reclassifiedFromSnapshot": duplicate["id"]}
                with (directory / "receipt.json").open("xb") as stream: stream.write(json_bytes(entry))
                updated = {**manifest, "snapshots": [*manifest["snapshots"], entry]}
                atomic_write(archive / "manifest.json", json_bytes(updated))
                return {"duplicate": True, "rosterReclassified": True, "archive": archive, "snapshot": entry,
                        "payload": result, "manifest": updated}
            return {"duplicate": True, "archive": archive, "snapshot": duplicate,
                    "payload": current, "manifest": manifest}

        if import_mode == "historical_backfill" and "latestEmployeeIds" not in current.get("_meta", {}):
            raise ValueError("Historical backfill requires an established current roster; import a current export first.")
        active_ids = current["_meta"]["latestEmployeeIds"] if import_mode == "historical_backfill" else sorted({employee_id(row["Employee"]) for row in incoming.values()})
        now = datetime.now(timezone.utc)
        stamp = now.isoformat(timespec="microseconds")
        snapshot_id = now.strftime("%Y%m%dT%H%M%S.%fZ") + "_" + source_hash[:12] + "_" + uuid.uuid4().hex[:8]
        directory = archive / "snapshots" / snapshot_id
        directory.mkdir(parents=True, exist_ok=False)
        raw_name = "EmployeeProductionExport_" + snapshot_id + source.suffix.lower()
        raw_path = directory / raw_name
        # Exclusive writes: older snapshots can never be overwritten.
        with raw_path.open("xb") as stream:
            stream.write(source_bytes)
            stream.flush()
            os.fsync(stream.fileno())
        read_checked(raw_path, source_hash)
        effective = {row_key(row): row for row in current["EmployeeProductionHistory"]}
        new_count = revised_count = 0
        for key, row in incoming.items():
            previous = effective.get(key)
            digest = sha256(json_bytes(row))
            prior = previous.get("_history", {}) if previous else {}
            changed = previous is not None and prior.get("rowSha256") != digest
            new_count += previous is None
            revised_count += changed
            effective[key] = {**row, "_history": {
                "firstSeenAt": prior.get("firstSeenAt", stamp), "lastSeenAt": stamp,
                "revisedAt": stamp if changed or not previous else prior["revisedAt"],
                "revision": prior.get("revision", 0) + (1 if changed or not previous else 0),
                "sourceSha256": source_hash, "rowSha256": digest,
                "importMode": import_mode,
                "previousSourceSha256": prior.get("sourceSha256") if changed else prior.get("previousSourceSha256"),
            }}
        result = {"EmployeeProductionHistory": [effective[key] for key in sorted(effective)],
                  "_meta": {"schemaVersion": SCHEMA, "importedAt": stamp,
                            "latestExportSha256": source_hash, "snapshotId": snapshot_id,
                            "snapshotCount": len(manifest["snapshots"]) + 1,
                            "latestEmployeeIds": active_ids,
                            "latestImportMode": import_mode,
                            "rosterSourceSha256": (current["_meta"].get("rosterSourceSha256", current["_meta"].get("latestExportSha256")) if import_mode == "historical_backfill" else source_hash),
                            "rosterPolicy": "preserve current roster" if import_mode == "historical_backfill" else "current export defines active roster",
                            "historyPolicy": "latest observed revision wins; absence is not deletion",
                            "firstArchivedAt": current["_meta"].get("firstArchivedAt", stamp)}}
        effective_bytes = gzip.compress(json_bytes(result), mtime=0)
        with (directory / "effective.json.gz").open("xb") as stream:
            stream.write(effective_bytes)
            stream.flush()
            os.fsync(stream.fileno())
        entry = {"id": snapshot_id, "receivedAt": stamp, "sourceName": source.name,
                 "sourceSha256": source_hash, "importMode": import_mode, "activeEmployeeCount": len(active_ids), "rawFile": str(raw_path.relative_to(archive)),
                 "effectiveFile": str((directory / "effective.json.gz").relative_to(archive)),
                 "effectiveSha256": sha256(effective_bytes), "incomingRows": len(incoming),
                 "effectiveRows": len(effective), "newRows": new_count, "revisedRows": revised_count,
                 "coverageStart": min(str(r['DateOfInv'])[:10] for r in incoming.values()),
                 "coverageEnd": max(str(r['DateOfInv'])[:10] for r in incoming.values()),
                 "retainedAbsentRows": len(set(effective) - set(incoming))}
        with (directory / "receipt.json").open("xb") as stream:
            stream.write(json_bytes(entry))
        updated = {**manifest, "snapshots": [*manifest["snapshots"], entry]}
        atomic_write(archive / "manifest.json", json_bytes(updated))
        return {"duplicate": False, "archive": archive, "snapshot": entry,
                "payload": result, "manifest": updated}


def verify_archive(archive: Path):
    manifest = load_manifest(archive)
    for entry in manifest["snapshots"]:
        read_checked(archive / entry["rawFile"], entry["sourceSha256"])
        read_checked(archive / entry["effectiveFile"], entry["effectiveSha256"])
    return len(manifest["snapshots"])


def history_as_of(archive: Path, received_before: str):
    """Read only revisions actually archived before an aware timestamp (exclusive)."""
    cutoff = datetime.fromisoformat(received_before)
    if cutoff.tzinfo is None:
        raise ValueError("As-of cutoff must include a timezone.")
    manifest = load_manifest(archive)
    earlier = [entry for entry in manifest["snapshots"]
               if datetime.fromisoformat(entry["receivedAt"]) < cutoff]
    return latest_payload(archive, {**manifest, "snapshots": earlier})

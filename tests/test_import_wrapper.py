"""Exercise actual .cmd quoting/control flow with an inert converter in a temp repo."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


@unittest.skipUnless(os.name == "nt", "Windows drag-and-drop wrapper")
class WrapperTests(unittest.TestCase):
    def test_spaces_same_name_error_and_single_file_guard(self):
        with tempfile.TemporaryDirectory(prefix="predictor wrapper ") as temp:
            root = Path(temp).resolve()
            repo = root / "website with spaces"
            inbox = root / "received files & weekly"
            repo.mkdir()
            inbox.mkdir()
            wrapper = repo / "ImportEmployeeExport.cmd"
            wrapper.write_bytes((Path(__file__).resolve().parents[1] / wrapper.name).read_bytes())
            (repo / "convert_xl_to_json.py").write_text(
                "import json,os,sys\nfrom pathlib import Path\n"
                "print('CAPTURE='+json.dumps(sys.argv[1:]))\n"
                "sys.exit(int(os.environ.get('WRAPPER_TEST_EXIT','0')) if Path(sys.argv[1]).is_file() else 3)\n"
            )
            workbook = inbox / "EmployeeProductionExport.xlsx"
            workbook.write_bytes(b"inert test file; never read as Excel")

            def invoke(args, exit_code=0):
                command = 'cmd.exe /d /s /c ""' + str(wrapper) + '"' + ''.join(' "' + str(arg) + '"' for arg in args) + '"'
                return subprocess.run(command, shell=False, cwd=root, input="\n\n", text=True,
                                      capture_output=True, timeout=20,
                                      env={**os.environ, "WRAPPER_TEST_EXIT": str(exit_code)})

            success = invoke([workbook])
            self.assertEqual(success.returncode, 0, success.stdout + success.stderr)
            captured = next(line[8:] for line in success.stdout.splitlines() if line.startswith("CAPTURE="))
            self.assertEqual(json.loads(captured), [str(workbook), "--repo", ".", "--local-only"])
            relative = invoke([workbook.relative_to(root)])
            self.assertEqual(relative.returncode, 0)
            captured_relative = next(line[8:] for line in relative.stdout.splitlines() if line.startswith("CAPTURE="))
            self.assertEqual(json.loads(captured_relative)[0], str(workbook))
            failure = invoke([workbook], 7)
            self.assertEqual(failure.returncode, 7)
            self.assertIn("Import stopped", failure.stdout)
            self.assertEqual(invoke([inbox / "missing.xlsx"]).returncode, 3)
            multiple = invoke([workbook, workbook])
            self.assertEqual(multiple.returncode, 1)
            self.assertNotIn("CAPTURE=", multiple.stdout)
            self.assertEqual(invoke([]).returncode, 1)


if __name__ == "__main__":
    unittest.main()

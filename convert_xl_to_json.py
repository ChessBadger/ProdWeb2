#!/usr/bin/env python3

import argparse
import json
import logging
import shutil
import subprocess
import sys
from pathlib import Path

import pandas as pd

DEFAULT_REPO = Path(r"C:\Users\Laptop 122\Desktop\Store Prep\06 Employee Reports\Website")
DEFAULT_WORKBOOK_NAMES = (
    "EmployeeProductionExport.xlsx",
    "ScheduleFinalFull.xlsx",
)
DEFAULT_COPY_TARGETS = ["public/data", "docs/data", "data"]
EXCEL_EXTENSIONS = (".xlsx", ".xlsm", ".xls")
MODE_LOCAL_ONLY = "local"
MODE_FULL = "full"


def get_excel_engine(excel_path: Path) -> str | None:
    suffix = excel_path.suffix.lower()
    if suffix == ".xls":
        return "xlrd"
    if suffix in {".xlsx", ".xlsm"}:
        return "openpyxl"
    return None


def convert_excel_to_json(excel_path: Path, json_path: Path):
    """
    Read each sheet from the Excel file, replace NaNs with 0, and write to JSON.
    """
    engine = get_excel_engine(excel_path)
    try:
        sheets = pd.read_excel(excel_path, sheet_name=None, engine=engine)
    except ImportError as exc:
        if excel_path.suffix.lower() == ".xls":
            raise ImportError(
                f"{exc}\n\nInstall the missing dependency with:\n"
                "python -m pip install xlrd>=2.0.1"
            ) from exc
        raise
    data = {
        name: df.fillna(0).to_dict(orient="records")
        for name, df in sheets.items()
    }
    json_path.parent.mkdir(parents=True, exist_ok=True)
    with json_path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=4, ensure_ascii=False, default=str)
    logging.info("Converted %s sheet(s) -> %s", len(sheets), json_path)


def copy_json_to_targets(json_path: Path, repo_root: Path, targets: list[str]):
    """
    Copy the JSON file into each of the specified directories under the repo.
    """
    for rel_dir in targets:
        dest_dir = repo_root / rel_dir
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest_file = dest_dir / json_path.name
        shutil.copy2(json_path, dest_file)
        logging.info("Copied JSON -> %s", dest_file)


def run_npm_build(repo_root: Path) -> bool:
    """
    Run `npm run build` in the repo root, with a check for npm availability.
    """
    npm_cmd = shutil.which("npm") or shutil.which("npm.cmd")
    if not npm_cmd:
        logging.error("npm not found; please install Node.js and ensure npm is in your PATH.")
        return False

    try:
        subprocess.run([npm_cmd, "run", "build"], cwd=repo_root, check=True)
        logging.info("npm run build succeeded")
        return True
    except subprocess.CalledProcessError as e:
        logging.error("npm build failed: %s", e)
        return False


def git_add_commit_push(repo_root: Path, message: str) -> bool:
    """
    Stage all changes, commit with the given message, and push.
    """
    try:
        subprocess.run(["git", "add", "."], cwd=repo_root, check=True)
        staged_changes = subprocess.run(
            ["git", "diff", "--cached", "--quiet"],
            cwd=repo_root,
            check=False,
        )
        if staged_changes.returncode == 0:
            logging.info("No staged changes detected; skipping git commit and push.")
            return True
        if staged_changes.returncode != 1:
            logging.error(
                "Unable to determine whether staged changes exist (git diff exit code %s).",
                staged_changes.returncode,
            )
            return False

        subprocess.run(["git", "commit", "-m", message], cwd=repo_root, check=True)
        subprocess.run(["git", "push"], cwd=repo_root, check=True)
        logging.info("Changes pushed to remote")
        return True
    except subprocess.CalledProcessError as e:
        logging.error("Git operation failed: %s", e)
        return False


def infer_repo_root(positional_paths: list[Path], explicit_repo: Path | None) -> tuple[Path, list[Path]]:
    if explicit_repo is not None:
        return explicit_repo, positional_paths

    if positional_paths and positional_paths[-1].exists() and positional_paths[-1].is_dir():
        return positional_paths[-1], positional_paths[:-1]

    return DEFAULT_REPO, positional_paths


def find_matching_workbooks(requested_path: Path) -> list[Path]:
    parent_dir = requested_path.parent
    if not parent_dir.exists():
        return []

    requested_stem = requested_path.stem.casefold()
    extension_priority = {
        extension: index for index, extension in enumerate(EXCEL_EXTENSIONS)
    }
    matches = [
        candidate
        for candidate in parent_dir.iterdir()
        if candidate.is_file()
        and candidate.suffix.lower() in EXCEL_EXTENSIONS
        and candidate.stem.casefold().startswith(requested_stem)
    ]
    return sorted(
        matches,
        key=lambda candidate: (
            candidate.stem.casefold() != requested_stem,
            extension_priority.get(candidate.suffix.lower(), len(EXCEL_EXTENSIONS)),
            candidate.name.casefold(),
        ),
    )


def resolve_default_workbook_path(repo_root: Path, workbook_name: str) -> Path:
    requested_path = repo_root / workbook_name
    if requested_path.exists():
        return requested_path

    matches = find_matching_workbooks(requested_path)
    if matches:
        logging.info(
            "Default workbook %s not found; using %s instead",
            requested_path.name,
            matches[0].name,
        )
        return matches[0]

    return requested_path


def resolve_excel_paths(repo_root: Path, positional_paths: list[Path]) -> list[Path]:
    if positional_paths:
        return positional_paths
    return [
        resolve_default_workbook_path(repo_root, workbook_name)
        for workbook_name in DEFAULT_WORKBOOK_NAMES
    ]


def format_missing_workbook_error(excel_path: Path) -> str:
    message = f"Excel file not found: {excel_path}"
    matches = find_matching_workbooks(excel_path)
    if matches:
        suggestions = ", ".join(candidate.name for candidate in matches)
        return f"{message}. Nearby matches: {suggestions}"
    return message


def choose_run_mode(args: argparse.Namespace) -> str:
    if args.local_only:
        return MODE_LOCAL_ONLY
    if args.full:
        return MODE_FULL
    if not sys.stdin.isatty():
        logging.info("No interactive input available; running full workflow.")
        return MODE_FULL

    print("Choose what to run:")
    print("  1) Local update: convert, copy JSON, and build without git")
    print("  2) Full workflow: convert, copy JSON, build, commit, and push")
    while True:
        choice = input("Enter 1 or 2 [1]: ").strip().lower()
        if choice in {"", "1", "local", "local-only", "no-git"}:
            return MODE_LOCAL_ONLY
        if choice in {"2", "full", "all"}:
            return MODE_FULL
        print("Please enter 1 for local update without git or 2 for the full workflow.")


def main():
    parser = argparse.ArgumentParser(
        description="Convert one or more Excel workbooks to JSON, copy to data dirs, build, and optionally push."
    )
    parser.add_argument(
        "paths",
        type=Path,
        nargs="*",
        help="Optional Excel file path(s). If omitted, the default workbooks are converted."
    )
    parser.add_argument(
        "--repo",
        type=Path,
        help="Local Git repo root (defaults to the hard-coded repo path)."
    )
    parser.add_argument(
        "-o", "--output",
        type=Path,
        help="Where to write the JSON when converting a single workbook (default: repo/<excel_name>.json)."
    )
    parser.add_argument(
        "-m", "--message",
        default="Auto-update: Excel to JSON, copied, built & pushed",
        help="Git commit message"
    )
    mode_group = parser.add_mutually_exclusive_group()
    mode_group.add_argument(
        "--local-only",
        action="store_true",
        help="Convert, copy JSON, and build; do not run git add, commit, or push."
    )
    mode_group.add_argument(
        "--full",
        action="store_true",
        help="Run the full workflow without prompting."
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s: %(message)s"
    )

    repo_root, positional_excel_paths = infer_repo_root(args.paths, args.repo)
    excel_paths = resolve_excel_paths(repo_root, positional_excel_paths)

    if args.output and len(excel_paths) != 1:
        parser.error("--output can only be used when converting a single workbook.")

    for excel_path in excel_paths:
        if not excel_path.exists():
            logging.error(format_missing_workbook_error(excel_path))
            return 1

    run_mode = choose_run_mode(args)

    for excel_path in excel_paths:
        json_path = args.output or (repo_root / f"{excel_path.stem}.json")
        convert_excel_to_json(excel_path, json_path)
        copy_json_to_targets(
            json_path,
            repo_root,
            targets=DEFAULT_COPY_TARGETS,
        )

    if not run_npm_build(repo_root):
        return 1
    if run_mode == MODE_LOCAL_ONLY:
        logging.info("Local-only mode complete; skipped git add, commit, and push.")
        return 0
    if not git_add_commit_push(repo_root, args.message):
        return 1
    return 0


if __name__ == "__main__":
    exit_code = main()
    if exit_code and sys.gettrace() is None:
        sys.exit(exit_code)

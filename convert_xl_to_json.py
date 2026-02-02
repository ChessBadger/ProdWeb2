#!/usr/bin/env python3

import argparse
import json
import logging
import shutil
import subprocess
import sys
from pathlib import Path

import pandas as pd


def convert_excel_to_json(excel_path: Path, json_path: Path):
    """
    Read each sheet from the Excel file, replace NaNs with 0, and write to JSON.
    """
    sheets = pd.read_excel(excel_path, sheet_name=None)
    data = {
        name: df.fillna(0).to_dict(orient="records")
        for name, df in sheets.items()
    }
    json_path.parent.mkdir(parents=True, exist_ok=True)
    with json_path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=4, ensure_ascii=False, default=str)
    logging.info(f"✅ Converted {len(sheets)} sheet(s) → {json_path}")


def copy_json_to_targets(json_path: Path, repo_root: Path, targets: list[str]):
    """
    Copy the JSON file into each of the specified directories under the repo.
    """
    for rel_dir in targets:
        dest_dir = repo_root / rel_dir
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest_file = dest_dir / json_path.name
        shutil.copy2(json_path, dest_file)
        logging.info(f"📋 Copied JSON → {dest_file}")


def run_npm_build(repo_root: Path):
    """
    Run `npm run build` in the repo root, with a check for npm availability.
    """
    # Locate npm executable
    npm_cmd = shutil.which("npm") or shutil.which("npm.cmd")
    if not npm_cmd:
        logging.error("❌ npm not found; please install Node.js and ensure npm is in your PATH.")
        sys.exit(1)
    try:
        subprocess.run([npm_cmd, "run", "build"], cwd=repo_root, check=True)
        logging.info("🔧 npm run build succeeded")
    except subprocess.CalledProcessError as e:
        logging.error(f"❌ npm build failed: {e}")
        sys.exit(1)


def git_add_commit_push(repo_root: Path, message: str):
    """
    Stage all changes, commit with the given message, and push.
    """
    try:
        subprocess.run(["git", "add", "."], cwd=repo_root, check=True)
        subprocess.run(["git", "commit", "-m", message], cwd=repo_root, check=True)
        subprocess.run(["git", "push"], cwd=repo_root, check=True)
        logging.info("🚀 Changes pushed to remote")
    except subprocess.CalledProcessError as e:
        logging.error(f"❌ Git operation failed: {e}")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description="Convert an Excel workbook to JSON, copy to data dirs, build & push"
    )
    parser.add_argument(
        "excel",
        type=Path,
        nargs="?",
        default=Path(r"C:\Users\Laptop 122\Desktop\Store Prep\05 Employee Reports\Website\EmployeeProductionExport.xlsx"),
        help="Path to input Excel file (default: hard‑coded)"
    )
    parser.add_argument(
        "repo",
        type=Path,
        nargs="?",
        default=Path(r"C:\Users\Laptop 122\Desktop\Store Prep\05 Employee Reports\Website"),
        help="Local Git repo root (default: hard‑coded)"
    )
    parser.add_argument(
        "-o", "--output",
        type=Path,
        help="Where to write the JSON (default: repo/<excel_name>.json)"
    )
    parser.add_argument(
        "-m", "--message",
        default="Auto-update: Excel→JSON, copied, built & pushed",
        help="Git commit message"
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s: %(message)s"
    )

    json_path = args.output or (args.repo / f"{args.excel.stem}.json")

    # 1. Convert Excel → JSON
    convert_excel_to_json(args.excel, json_path)

    # 2. Copy JSON into the three target dirs
    copy_json_to_targets(
        json_path,
        args.repo,
        targets=["public/data", "docs/data", "data"]
    )

    # 3. Run the frontend build
    run_npm_build(args.repo)

    # 4. Commit & push everything
    git_add_commit_push(args.repo, args.message)

if __name__ == "__main__":
    main()

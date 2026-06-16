#!/usr/bin/env python3

import argparse
import base64
import http.server
import json
import logging
import os
import re
import shutil
import socket
import struct
import subprocess
import sys
import tempfile
import threading
import time
import urllib.parse
import urllib.request
from pathlib import Path

import pandas as pd

DEFAULT_REPO = Path(r"C:\Users\Laptop 122\Desktop\Store Prep\06 Employee Reports\Website")
DEFAULT_WORKBOOK_NAMES = (
    "EmployeeProductionExport.xlsx",
    "ScheduleFinalFull.xlsx",
)
DEFAULT_COPY_TARGETS = ["public/data", "docs/data", "data"]
ANALYTICS_SNAPSHOT_NAME = "ScheduleAnalyticsSnapshot.json"
EXCEL_EXTENSIONS = (".xlsx", ".xlsm", ".xls")
MODE_LOCAL_ONLY = "local"
MODE_FULL = "full"
SCHEDULE_PLANNING_HTML_PATHS = (
    "public/scheduleplanning.html",
    "docs/scheduleplanning.html",
)
SCHEDULE_PLANNING_APP_PATHS = (
    "public/scheduleplanningapp.js",
    "docs/scheduleplanningapp.js",
)


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
        if json_path.resolve() == dest_file.resolve():
            logging.info("JSON already in target -> %s", dest_file)
            continue
        shutil.copy2(json_path, dest_file)
        logging.info("Copied JSON -> %s", dest_file)


def bump_schedule_planning_asset_versions(repo_root: Path):
    """
    Force browsers to request the latest planner JS/CSS/JSON after data updates.
    """
    version = time.strftime("%Y%m%d-%H%M%S")
    html_pattern = re.compile(
        r"(scheduleplanning(?:app\.js|style\.css)\?v=)[A-Za-z0-9._-]+"
    )
    data_pattern = re.compile(
        r'(const DATA_ASSET_VERSION = ")[^"]+(";)',
    )

    for rel_path in SCHEDULE_PLANNING_HTML_PATHS:
        html_path = repo_root / rel_path
        if not html_path.exists():
            logging.warning("Schedule planning HTML not found: %s", html_path)
            continue

        original = html_path.read_text(encoding="utf-8")
        updated = html_pattern.sub(rf"\g<1>{version}", original)
        if updated == original:
            logging.warning("No schedule planning asset versions found in %s", html_path)
            continue

        html_path.write_text(updated, encoding="utf-8")
        logging.info("Updated schedule planning asset version -> %s", html_path)

    for rel_path in SCHEDULE_PLANNING_APP_PATHS:
        app_path = repo_root / rel_path
        if not app_path.exists():
            logging.warning("Schedule planning app JS not found: %s", app_path)
            continue

        original = app_path.read_text(encoding="utf-8")
        updated = data_pattern.sub(rf"\g<1>{version}\g<2>", original)
        if updated == original:
            logging.warning("No schedule planning data version found in %s", app_path)
            continue

        app_path.write_text(updated, encoding="utf-8")
        logging.info("Updated schedule planning data version -> %s", app_path)


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


class QuietHttpRequestHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args):  # noqa: A002 - stdlib method name
        return


def find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def find_headless_browser() -> str | None:
    command_names = ("msedge", "chrome", "chromium")
    for command_name in command_names:
        browser = shutil.which(command_name)
        if browser:
            return browser

    candidates = [
        Path(r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"),
        Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
        Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
        Path(r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return str(candidate)
    return None


def run_local_http_server(repo_root: Path):
    port = find_free_port()
    handler = lambda *args, **kwargs: QuietHttpRequestHandler(
        *args,
        directory=str(repo_root),
        **kwargs,
    )
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, port


def terminate_process_tree(process: subprocess.Popen, timeout_seconds: int = 5):
    if process.poll() is not None:
        return

    if os.name == "nt":
        subprocess.run(
            ["taskkill", "/PID", str(process.pid), "/T", "/F"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
        try:
            process.wait(timeout=timeout_seconds)
        except subprocess.TimeoutExpired:
            pass
        return

    process.terminate()
    try:
        process.wait(timeout=timeout_seconds)
    except subprocess.TimeoutExpired:
        process.kill()


def websocket_recv_exact(sock: socket.socket, length: int) -> bytes:
    chunks = []
    remaining = length
    while remaining > 0:
        chunk = sock.recv(remaining)
        if not chunk:
            raise ConnectionError("WebSocket connection closed unexpectedly.")
        chunks.append(chunk)
        remaining -= len(chunk)
    return b"".join(chunks)


def websocket_send_text(sock: socket.socket, message: str):
    payload = message.encode("utf-8")
    mask_key = os.urandom(4)
    header = bytearray([0x81])
    length = len(payload)
    if length < 126:
        header.append(0x80 | length)
    elif length < 65536:
        header.append(0x80 | 126)
        header.extend(struct.pack("!H", length))
    else:
        header.append(0x80 | 127)
        header.extend(struct.pack("!Q", length))
    header.extend(mask_key)
    masked = bytes(byte ^ mask_key[index % 4] for index, byte in enumerate(payload))
    sock.sendall(bytes(header) + masked)


def websocket_recv_text(sock: socket.socket) -> str:
    while True:
        first, second = websocket_recv_exact(sock, 2)
        opcode = first & 0x0F
        masked = bool(second & 0x80)
        length = second & 0x7F
        if length == 126:
            length = struct.unpack("!H", websocket_recv_exact(sock, 2))[0]
        elif length == 127:
            length = struct.unpack("!Q", websocket_recv_exact(sock, 8))[0]
        mask_key = websocket_recv_exact(sock, 4) if masked else b""
        payload = websocket_recv_exact(sock, length) if length else b""
        if masked:
            payload = bytes(
                byte ^ mask_key[index % 4] for index, byte in enumerate(payload)
            )
        if opcode == 0x8:
            raise ConnectionError("WebSocket closed by browser.")
        if opcode == 0x9:
            continue
        if opcode in {0x1, 0x0}:
            return payload.decode("utf-8", errors="replace")


def connect_websocket(websocket_url: str) -> socket.socket:
    parsed = urllib.parse.urlparse(websocket_url)
    host = parsed.hostname or "127.0.0.1"
    port = parsed.port or 80
    path = parsed.path or "/"
    if parsed.query:
        path = f"{path}?{parsed.query}"
    key = base64.b64encode(os.urandom(16)).decode("ascii")
    sock = socket.create_connection((host, port), timeout=10)
    request = (
        f"GET {path} HTTP/1.1\r\n"
        f"Host: {host}:{port}\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        f"Sec-WebSocket-Key: {key}\r\n"
        "Sec-WebSocket-Version: 13\r\n"
        "\r\n"
    )
    sock.sendall(request.encode("ascii"))
    response = b""
    while b"\r\n\r\n" not in response:
        response += sock.recv(4096)
    if b" 101 " not in response.split(b"\r\n", 1)[0]:
        sock.close()
        raise ConnectionError("Browser did not accept DevTools WebSocket handshake.")
    sock.settimeout(None)
    return sock


def wait_for_devtools_target(debug_port: int, target_url: str, timeout_seconds: int) -> str:
    deadline = time.time() + timeout_seconds
    endpoint = f"http://127.0.0.1:{debug_port}/json"
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(endpoint, timeout=2) as response:
                targets = json.loads(response.read().decode("utf-8"))
            for target in targets:
                if target.get("type") == "page" and target_url in target.get("url", ""):
                    websocket_url = target.get("webSocketDebuggerUrl")
                    if websocket_url:
                        return websocket_url
        except Exception:
            pass
        time.sleep(0.5)
    raise TimeoutError("Timed out waiting for browser DevTools target.")


def wait_for_precompute_result(
    websocket_url: str,
    timeout_seconds: int,
) -> dict:
    expression = f"""
      new Promise((resolve) => {{
        const finish = () => {{
          if (window.__ANALYTICS_PRECOMPUTE_DONE__) {{
            resolve(window.__ANALYTICS_PRECOMPUTE_DONE__);
            return true;
          }}
          return false;
        }};
        if (finish()) return;
        const timer = setInterval(() => {{
          if (finish()) clearInterval(timer);
        }}, 500);
        setTimeout(() => {{
          clearInterval(timer);
          resolve({{ ok: false, payload: {{ message: "Timed out waiting for analytics precompute." }} }});
        }}, {max(1000, (timeout_seconds - 5) * 1000)});
      }})
    """
    message_id = 1
    command = {
        "id": message_id,
        "method": "Runtime.evaluate",
        "params": {
            "expression": expression,
            "awaitPromise": True,
            "returnByValue": True,
            "timeout": timeout_seconds * 1000,
        },
    }

    deadline = time.time() + timeout_seconds
    last_error = None
    while time.time() < deadline:
        sock = connect_websocket(websocket_url)
        try:
            websocket_send_text(sock, json.dumps(command))
            while time.time() < deadline:
                response = json.loads(websocket_recv_text(sock))
                if response.get("id") != message_id:
                    continue
                if "error" in response:
                    last_error = response["error"]
                    break
                result = response.get("result", {}).get("result", {})
                return result.get("value") or {}
        finally:
            sock.close()
        if isinstance(last_error, dict) and "context was destroyed" in str(
            last_error.get("message", "")
        ).lower():
            time.sleep(1)
            continue
        if last_error:
            raise RuntimeError(last_error)
    raise TimeoutError("Timed out waiting for analytics precompute result.")


def precompute_analytics_snapshot(repo_root: Path, timeout_seconds: int) -> bool:
    browser = find_headless_browser()
    if not browser:
        logging.error("No supported headless browser found. Install Microsoft Edge or Chrome.")
        return False

    server, port = run_local_http_server(repo_root)
    debug_port = find_free_port()
    url = f"http://127.0.0.1:{port}/public/scheduleplanning.html?precomputeAnalytics=1"
    user_data_parent = tempfile.TemporaryDirectory(
        prefix="analytics-precompute-",
        ignore_cleanup_errors=True,
    )
    user_data_dir = Path(user_data_parent.name) / "profile"

    command = [
        browser,
        "--headless=new",
        "--disable-gpu",
        "--disable-extensions",
        "--no-first-run",
        "--no-default-browser-check",
        "--remote-debugging-address=127.0.0.1",
        f"--remote-debugging-port={debug_port}",
        f"--user-data-dir={user_data_dir}",
        url,
    ]
    process = None

    try:
        logging.info("Precomputing schedule analytics snapshot...")
        process = subprocess.Popen(
            command,
            cwd=repo_root,
            text=True,
            encoding="utf-8",
            errors="replace",
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )
        websocket_url = wait_for_devtools_target(debug_port, url, 30)
        output = wait_for_precompute_result(websocket_url, timeout_seconds)
        if not output.get("ok"):
            logging.error("Analytics precompute failed: %s", output.get("payload"))
            return False

        snapshot_path = repo_root / "data" / ANALYTICS_SNAPSHOT_NAME
        snapshot_path.parent.mkdir(parents=True, exist_ok=True)
        with snapshot_path.open("w", encoding="utf-8") as snapshot_file:
            json.dump(output["payload"], snapshot_file, indent=2, ensure_ascii=False)
            snapshot_file.write("\n")

        copy_json_to_targets(
            snapshot_path,
            repo_root,
            targets=DEFAULT_COPY_TARGETS,
        )
        logging.info("Precomputed analytics snapshot -> %s", snapshot_path)
        return True
    except Exception as exc:
        logging.error("Analytics precompute failed: %s", exc)
        if process:
            if process.poll() is not None:
                logging.error("Headless browser exited with code %s.", process.returncode)
            stderr = ""
            if process.stderr:
                try:
                    stderr = process.stderr.read()
                except Exception:
                    stderr = ""
            if stderr:
                logging.error("Headless browser stderr:\n%s", stderr[-4000:].rstrip())
        return False
    finally:
        if process:
            terminate_process_tree(process)
        server.shutdown()
        server.server_close()
        user_data_parent.cleanup()


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
    parser.add_argument(
        "--skip-analytics-precompute",
        action="store_true",
        help="Skip generating the precomputed schedule analytics snapshot."
    )
    parser.add_argument(
        "--analytics-timeout",
        type=int,
        default=900,
        help="Seconds to allow for analytics precompute (default: 900)."
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

    if not args.skip_analytics_precompute:
        if not precompute_analytics_snapshot(repo_root, args.analytics_timeout):
            return 1

    bump_schedule_planning_asset_versions(repo_root)

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

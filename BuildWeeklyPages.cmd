@echo off
setlocal
cd /d "%~dp0"
set "sitePython=C:\Users\Laptop 122\AppData\Local\Programs\Python\Python312\python.exe"
if not exist "%sitePython%" set "sitePython=python"
"%sitePython%" -B local_app\static_tools\export_week.py %*
if errorlevel 1 (echo Export failed. Prior local history remains intact.) else (echo Shared release is in pages_repository. Review pages_export\export-allowlist.json, then commit and push ONLY the clean publishing folder. Visitors load approved current-roster planning data automatically.)
pause

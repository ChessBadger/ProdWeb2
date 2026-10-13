@echo off
setlocal
cd /d "%~dp0"
set "sitePython=C:\Users\Laptop 122\AppData\Local\Programs\Python\Python312\python.exe"
if not exist "%sitePython%" set "sitePython=python"
if "%~1"=="" (
  "%sitePython%" -B local_app\server.py --open-browser
) else (
  "%sitePython%" -B local_app\server.py --data-dir "%~f1" --open-browser
)
if errorlevel 1 pause

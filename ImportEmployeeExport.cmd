@echo off
setlocal
if "%~1"=="" (
  echo Drag the received EmployeeProductionExport workbook onto this file.
  echo It will be archived locally before data is updated. Nothing is pushed.
  pause
  exit /b 1
)
if not "%~2"=="" (
  echo Drop one workbook at a time so each receipt is explicit.
  pause
  exit /b 1
)
set "receivedWorkbook=%~f1"
pushd "%~dp0" || exit /b 1
python -B convert_xl_to_json.py "%receivedWorkbook%" --repo "." --local-only
set "importResult=%ERRORLEVEL%"
popd
if not "%importResult%"=="0" echo Import stopped. Read the error above; do not discard the received workbook.
pause
exit /b %importResult%

@echo off
setlocal
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe (
  python -m venv .venv || exit /b 1
)
.venv\Scripts\python.exe -m pip install -r backend\requirements.txt -r packaging\requirements-windows.txt || exit /b 1
pushd ui
call npm ci
if errorlevel 1 (popd & exit /b 1)
call npm run build
if errorlevel 1 (popd & exit /b 1)
popd
echo edeco Toolbox ist eingerichtet.

@echo off
setlocal
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe call setup.bat
if errorlevel 1 goto :error
if not exist ui\dist\index.html call setup.bat
if errorlevel 1 goto :error
set "PYTHONPATH=%~dp0backend"
.venv\Scripts\python.exe -m edeco_toolbox %*
if errorlevel 1 goto :error
goto :eof
:error
echo Fehler beim Start. Details stehen oben.
exit /b 1

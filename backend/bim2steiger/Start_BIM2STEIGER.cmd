@echo off
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel% equ 0 (
  py -3 launch.py
  goto done
)
where python >nul 2>nul
if %errorlevel% equ 0 (
  python launch.py
  goto done
)
if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" (
  "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" launch.py
  goto done
)
echo Python 3.11 oder neuer wird benoetigt.
pause
exit /b 1
:done
if errorlevel 1 pause

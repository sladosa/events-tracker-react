@echo off
REM One-time setup: creates venv in Tools\venv\ and installs all packages.
REM Run this once from any directory: just double-click or call from terminal.

set TOOLS_DIR=%~dp0
set VENV_DIR=%TOOLS_DIR%venv

echo === Events Tracker — Data Preparation Tools Setup ===
echo.

if exist "%VENV_DIR%\Scripts\python.exe" (
    echo [OK] venv already exists at %VENV_DIR%
    echo      To reinstall packages, delete the venv folder and re-run setup.bat
) else (
    echo Creating virtual environment...
    python -m venv "%VENV_DIR%"
    if errorlevel 1 (
        echo [ERROR] Failed to create venv. Is Python installed?
        pause
        exit /b 1
    )
    echo [OK] venv created.
)

echo.
echo Installing packages from requirements.txt...
"%VENV_DIR%\Scripts\pip" install -r "%TOOLS_DIR%requirements.txt" --quiet
if errorlevel 1 (
    echo [ERROR] pip install failed.
    pause
    exit /b 1
)

echo [OK] All packages installed.
echo.
echo Setup complete. You can now run scripts using:
echo   Tools\run.bat Health\make_health_structure.py
echo   Tools\run.bat Financije\make_import.py
echo.
pause

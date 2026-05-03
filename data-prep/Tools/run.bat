@echo off
REM Usage: Tools\run.bat <path\to\script.py> [args...]
REM   Called from the Data_preparation root, e.g.:
REM     Tools\run.bat Health\make_health_structure.py
REM     Tools\run.bat Financije\make_import.py input.xlsx

set TOOLS_DIR=%~dp0
set VENV_PYTHON=%TOOLS_DIR%venv\Scripts\python.exe

if not exist "%VENV_PYTHON%" (
    echo [ERROR] venv not found. Run Tools\setup.bat first.
    pause
    exit /b 1
)

if "%~1"=="" (
    echo Usage: run.bat path\to\script.py [args]
    pause
    exit /b 1
)

echo Running: %*
echo.
"%VENV_PYTHON%" %*
echo.
echo Done. Press any key to close.
pause

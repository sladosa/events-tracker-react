@echo off
REM Run any script in the Financije folder using the shared venv.
REM Usage: Financije\run.bat make_import.py
REM Or double-click to run make_import.py directly.

set FIN_DIR=%~dp0
set TOOLS_DIR=%FIN_DIR%..\Tools\
set VENV_PYTHON=%TOOLS_DIR%venv\Scripts\python.exe

if not exist "%VENV_PYTHON%" (
    echo [ERROR] venv not found. Run Tools\setup.bat first.
    pause
    exit /b 1
)

if "%~1"=="" (
    REM Default: generate import file
    echo Running: make_import.py
    "%VENV_PYTHON%" "%FIN_DIR%make_import.py"
) else (
    echo Running: %~1 %2 %3 %4
    "%VENV_PYTHON%" "%FIN_DIR%%~1" %2 %3 %4
)

echo.
pause

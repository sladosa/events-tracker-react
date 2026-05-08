@echo off
REM Run any script in the Health folder using the shared venv.
REM Usage from data-prep_tools root:  Health\run.bat make_health_structure.py
REM Or double-click to run make_health_structure.py directly.

set HEALTH_DIR=%~dp0
set TOOLS_DIR=%HEALTH_DIR%..\Tools\
set VENV_PYTHON=%TOOLS_DIR%venv\Scripts\python.exe

if not exist "%VENV_PYTHON%" (
    echo [ERROR] venv not found. Run Tools\setup.bat first.
    pause
    exit /b 1
)

if "%~1"=="" (
    REM Default: generate structure import file
    echo Running: make_health_structure.py
    "%VENV_PYTHON%" "%HEALTH_DIR%make_health_structure.py"
) else (
    echo Running: %~1 %2 %3 %4
    "%VENV_PYTHON%" "%HEALTH_DIR%%~1" %2 %3 %4
)

echo.
pause

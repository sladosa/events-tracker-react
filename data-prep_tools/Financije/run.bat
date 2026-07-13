@echo off
REM Run any script in the Financije folder using the shared venv.
REM Usage: Financije\run.bat inventory_izvoda.py [args]
REM Aktivni alati: inventory_izvoda, enrich_from_izvoda, apply_rules,
REM sync_taxonomy, normalize_financije (stari su u Obsolete\).

set FIN_DIR=%~dp0
set TOOLS_DIR=%FIN_DIR%..\Tools\
set VENV_PYTHON=%TOOLS_DIR%venv\Scripts\python.exe

if not exist "%VENV_PYTHON%" (
    echo [ERROR] venv not found. Run Tools\setup.bat first.
    pause
    exit /b 1
)

if "%~1"=="" (
    echo Usage: run.bat ^<skripta.py^> [args]
    echo   npr.  run.bat inventory_izvoda.py --dry
    echo         run.bat enrich_from_izvoda.py
) else (
    echo Running: %~1 %2 %3 %4
    "%VENV_PYTHON%" "%FIN_DIR%%~1" %2 %3 %4
)

echo.
pause

@echo off
setlocal enabledelayedexpansion
REM Run any script in the Financije folder using the shared venv.
REM Usage: Financije\run.bat uskladi_izvod.py --izvod MC_2026-09.pdf --dry
REM Mjesecni tok (docs\FINANCIJE_PROCES.md par. 5): razvrstaj_izvode, uskladi_izvod,
REM fill_from_izvod, visa_uvoz_izvoda, rate_alat, promet_check.
REM Baza: $env:ET_TARGET='prod' -- bez toga TEST (vrijedi za SVE alate od S158).
REM PDF se zadaje samo imenom; trazi se u cijelom izvodi\ (osim duplikati\).

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
    REM Svi argumenti, ne samo prva tri: %2 %3 %4 je TIHO rezao pete i dalje
    REM (fill_from_izvod.py --visa ... --naplata ... ima ih pet).
    for /f "tokens=1,* delims= " %%a in ("%*") do set ARGS=%%b
    echo Running: %~1 !ARGS!
    "%VENV_PYTHON%" "%FIN_DIR%%~1" !ARGS!
)

echo.
pause

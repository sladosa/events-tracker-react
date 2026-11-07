@echo off
setlocal
REM Mjesecni krug Financija -- jedna naredba (S195, docs\KRUG_SPEC.md).
REM Dvoklik = PROD: razvrstac izvoda, svi izvodi u korijenu izvodi\, sidra iz izvoda,
REM Excel + izvjestaj u Kokinu mapu OneDrive\Izvodi\Za uvoz; izvjestaj se otvori sam.
REM Probni prolaz bez ijednog upisa:  krug.bat --suho
REM Na TEST bazi:                     run.bat krug.py --suho   (bez ET_TARGET = TEST)

set ET_TARGET=prod
set FIN_DIR=%~dp0
set VENV_PYTHON=%FIN_DIR%..\Tools\venv\Scripts\python.exe

if not exist "%VENV_PYTHON%" (
    echo [ERROR] venv not found. Run Tools\setup.bat first.
    pause
    exit /b 1
)

"%VENV_PYTHON%" "%FIN_DIR%krug.py" %*
echo.
pause

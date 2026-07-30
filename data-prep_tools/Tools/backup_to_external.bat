@echo off
REM ===========================================================================
REM  Backup gitignoriranih podatkovnih direktorija na vanjski disk.
REM
REM  Git cuva ALATE (data-prep_tools/, src/, docs/) i njih ne treba backupirati.
REM  Ovi direktoriji su gitignorirani = postoje SAMO na lokalnom disku:
REM     data-prep_data/   (Review Excel, AI predikcije, izvodi + OCR kes)
REM     Claude-temp_R/    (PENDING_TESTS.md, test-sessions/)
REM
REM  NAMJERNO NE koristi /MIR: mirror bi prenio i lokalno brisanje ili kvar
REM  na jedinu drugu kopiju. Ovaj backup samo DOPISUJE i osvjezava novije.
REM  Cijena: stari .pre-* backupi ostaju na vanjskom disku (par MB, jeftino).
REM
REM  Upotreba:  backup_to_external.bat  [ciljni_dir]
REM             (bez argumenta -> D:\DATA\events-tracker-react)
REM  Slovo diska se USB-u mijenja; ako nije D:, zadaj put kao argument.
REM ===========================================================================

setlocal
title Backup podataka na vanjski disk

set "SRC=C:\0_Sasa\events-tracker-react"
set "DST=%~1"
if "%DST%"=="" set "DST=D:\DATA\events-tracker-react"

set "DRIVE=%DST:~0,2%"
if not exist "%DRIVE%\" (
    echo [X] Disk %DRIVE% nije dostupan.
    echo     Prikljuci vanjski disk, ili zadaj drugi put:
    echo         %~nx0 E:\DATA\events-tracker-react
    echo.
    pause
    exit /b 1
)

echo Izvor : %SRC%
echo Cilj  : %DST%
echo Nacin : dopisivanje + osvjezavanje novijih ^(bez brisanja na cilju^)
echo.

set "RCOPT=/E /XO /R:1 /W:1 /NP /NDL /NJH /TEE /LOG+:%DST%\backup.log"
set "ERR=0"

echo --- data-prep_data ---------------------------------------------------
robocopy "%SRC%\data-prep_data" "%DST%\data-prep_data" %RCOPT%
if errorlevel 8 set "ERR=1"

echo --- Claude-temp_R ----------------------------------------------------
robocopy "%SRC%\Claude-temp_R" "%DST%\Claude-temp_R" %RCOPT%
if errorlevel 8 set "ERR=1"

echo.
if "%ERR%"=="1" (
    echo [X] Backup je zavrsio S GRESKOM - provjeri %DST%\backup.log
) else (
    echo [OK] Backup zavrsen. Log: %DST%\backup.log
)
echo.
pause

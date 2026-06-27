@echo off
chcp 65001 >nul
title Mo phong Co Quang Dien - Bai 9 KHTN7

echo.
echo  ================================================
echo    THI NGHIEM AO 3D - BAI 9: DO TOC DO
echo    Khoa hoc Tu nhien 7 (Dua tren Hinh 9.3)
echo  ================================================
echo.
echo  Dang khoi dong may chu...

:: Kiem tra Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo  [LOI] Chua cai dat Node.js!
    echo  Vui long tai va cai dat tu: https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: Khoi dong may chu HTTP khong co cache
start "" /b npx --yes http-server . -p 8080 -c-1 --silent

:: Cho may chu san sang
timeout /t 2 /nobreak >nul

:: Mo trinh duyet vao ung dung
echo  May chu dang chay tai: http://127.0.0.1:8080
echo.
echo  Dang mo trinh duyet...
start "" http://127.0.0.1:8080

echo  [OK] Ung dung da san sang!
echo.
echo  De dung ung dung: Dong cua so nay hoac nhan Ctrl+C
echo.
echo  ================================================
echo.

:: Giu cua so mo de server chay
npx --yes http-server . -p 8080 -c-1 --silent 2>nul

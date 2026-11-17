@echo off
title Git Push - Cap Nhat Code Len Web
echo ========================================================
echo        DONG BO DU LIEU VA CAP NHAT CODE LEN GITHUB
echo ========================================================
echo.

git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [CHU Y] May tinh chua nhan lenh 'git'.
    echo.
    echo Ban co the:
    echo 1. Cai dat Git tai: https://git-scm.com/download/win
    echo 2. Hoac keo tha file truc tiep tren web: GitHub.com -^> Add file -^> Upload files
    echo.
    pause
    exit /b
)

echo [1/3] Dang them cac file thay doi (git add .)...
git add .

echo.
set msg=Cap nhat bang cham cong, tinh luong va file Excel
set /p userMsg="Nhap ghi chu cap nhat (Nhan Enter de dung mac dinh): "
if not "%userMsg%"=="" set msg=%userMsg%

echo.
echo [2/3] Dang luu commit: "%msg%"...
git commit -m "%msg%"

echo.
echo [3/3] Dang day code len GitHub (git push)...
git push

echo.
if %errorlevel% equ 0 (
    echo ========================================================
    echo  [THANH CONG] Code da duoc day len GitHub!
    echo  He thong web dang tu dong cap nhat (Render / Vercel / GitHub Pages).
    echo  Vui long doi 1 - 2 phut roi tai lai trang web.
    echo ========================================================
) else (
    echo ========================================================
    echo  [HUONG DAN] Neu day la lan dau tien push code:
    echo  1. git branch -M main
    echo  2. git remote add origin https://github.com/TAI_KHOAN/REPO.git
    echo  3. git push -u origin main
    echo ========================================================
)
echo.
pause

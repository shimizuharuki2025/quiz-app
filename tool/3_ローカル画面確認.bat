@echo off
chcp 65001 > nul
title クイズアプリ - ローカル画面確認

echo ========================================
echo   ローカル画面確認
echo ========================================
echo.

REM サーバーが起動しているか確認
netstat -an | find ":10000" | find "LISTENING" > nul

if %errorlevel% neq 0 (
    echo サーバーが起動していません。
    echo サーバーを起動しています...
    echo.
    start "クイズアプリサーバー" cmd /k node server.js
    echo サーバーの起動を待っています...
    timeout /t 3 /nobreak > nul
)

echo ブラウザで画面を開きます...
echo.

REM クイズアプリを開く
start http://localhost:10000/quiz-app/

REM 管理ツールを開く
start http://localhost:10000/admin-tool/

echo.
echo ✓ ローカル画面を開きました
echo.
echo 【開いた画面】
echo - クイズアプリ: http://localhost:10000/quiz-app/
echo - 管理ツール: http://localhost:10000/admin-tool/
echo.
pause

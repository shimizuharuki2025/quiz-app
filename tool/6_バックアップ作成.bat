@echo off
chcp 65001 > nul
title クイズアプリ - バックアップ作成

echo ========================================
echo   バックアップ作成
echo ========================================
echo.

REM 日時を取得（YYYY-MM-DD_HHMMSS形式）
for /f "tokens=1-4 delims=/ " %%a in ('date /t') do (
    set datestr=%%a-%%b-%%c
)
for /f "tokens=1-2 delims=: " %%a in ('time /t') do (
    set timestr=%%a%%b
)
set timestamp=%datestr%_%timestr%

REM バックアップファイル名
set backupfile=backup_%timestamp%.json

REM クイズデータのパス
set datafile=public\quiz-app\quiz-data.json

REM ファイルが存在するか確認
if not exist "%datafile%" (
    echo ✗ クイズデータファイルが見つかりません
    echo   パス: %datafile%
    echo.
    pause
    exit /b
)

echo バックアップを作成しています...
echo.

REM バックアップディレクトリを作成
if not exist "backups" mkdir backups

REM ファイルをコピー
copy "%datafile%" "backups\%backupfile%"

if %errorlevel% equ 0 (
    echo ✓ バックアップを作成しました
    echo.
    echo 保存先: backups\%backupfile%
    echo.
    
    REM バックアップフォルダを開く
    explorer backups
) else (
    echo ✗ バックアップの作成に失敗しました
    echo.
)

pause

@echo off
chcp 65001 > nul
title クイズアプリ - 変更確認

echo ========================================
echo   変更確認
echo ========================================
echo.

REM 現在のブランチを表示
for /f "tokens=*" %%i in ('git branch --show-current') do set branch=%%i
echo 現在のブランチ: %branch%
echo.

REM 変更されたファイルの一覧
echo 【変更されたファイル】
echo.
git status --short

echo.
echo ========================================
echo.

REM 詳細な変更内容
echo 【詳細情報】
echo.
git status

echo.
pause

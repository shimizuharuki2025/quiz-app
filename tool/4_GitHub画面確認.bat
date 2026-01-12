@echo off
chcp 65001 > nul
title クイズアプリ - GitHub画面確認

echo ========================================
echo   GitHub 画面確認
echo ========================================
echo.
echo ブラウザでGitHubリポジトリを開きます...
echo.

REM GitHubリポジトリを開く
start https://github.com/shimizuharuki2025/quiz-app

echo ✓ GitHubリポジトリを開きました
echo.
echo URL: https://github.com/shimizuharuki2025/quiz-app
echo.
pause

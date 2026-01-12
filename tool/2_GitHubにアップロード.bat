@echo off
chcp 65001 > nul
title クイズアプリ - GitHubアップロード

echo ========================================
echo   GitHub アップロード
echo ========================================
echo.

REM 変更されたファイルを確認
echo 【変更されたファイルを確認中...】
echo.
git status
echo.

REM 変更がない場合は終了
git diff-index --quiet HEAD --
if %errorlevel% equ 0 (
    echo.
    echo ✓ 変更されたファイルはありません。
    echo.
    pause
    exit /b
)

echo ----------------------------------------
echo 上記のファイルをGitHubにアップロードします。
echo ----------------------------------------
echo.
set /p confirm="続行しますか？ (Y/N): "

if /i not "%confirm%"=="Y" (
    echo.
    echo キャンセルしました。
    pause
    exit /b
)

echo.
echo 【ファイルをステージング中...】
git add .

echo.
echo ✓ ファイルをステージングしました
echo.

REM コミットメッセージを入力
set /p message="コミットメッセージを入力してください: "

if "%message%"=="" (
    set message=変更をコミット
)

echo.
echo 【コミット中...】
git commit -m "%message%"

if %errorlevel% neq 0 (
    echo.
    echo ✗ コミットに失敗しました
    pause
    exit /b
)

echo.
echo ✓ コミットしました
echo.

echo 【GitHubにプッシュ中...】
git push

if %errorlevel% neq 0 (
    echo.
    echo ✗ プッシュに失敗しました
    pause
    exit /b
)

echo.
echo ========================================
echo   ✓ GitHubへのアップロードが完了しました！
echo ========================================
echo.
echo リポジトリURL: https://github.com/shimizuharuki2025/quiz-app
echo.
pause

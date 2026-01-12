@echo off
chcp 65001 > nul
title クイズアプリ - 最新版取得

echo ========================================
echo   最新版取得 (GitHub)
echo ========================================
echo.

REM ローカルの変更がないか確認
git diff-index --quiet HEAD --
if %errorlevel% neq 0 (
    echo ⚠ 警告: ローカルに未コミットの変更があります
    echo.
    git status --short
    echo.
    echo ----------------------------------------
    echo 最新版を取得すると、上記の変更が失われる可能性があります。
    echo 先に変更をコミットまたはバックアップしてください。
    echo ----------------------------------------
    echo.
    set /p confirm="それでも続行しますか？ (Y/N): "
    
    if /i not "!confirm!"=="Y" (
        echo.
        echo キャンセルしました。
        pause
        exit /b
    )
)

echo GitHubから最新版を取得しています...
echo.

git pull

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo   ✓ 最新版の取得が完了しました
    echo ========================================
    echo.
) else (
    echo.
    echo ✗ 最新版の取得に失敗しました
    echo.
    echo エラーが発生した場合は、以下を確認してください:
    echo - インターネット接続
    echo - GitHubへのアクセス権限
    echo - ローカルの変更がコンフリクトしていないか
    echo.
)

pause

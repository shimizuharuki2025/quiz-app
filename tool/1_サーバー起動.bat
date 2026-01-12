@echo off
chcp 65001 > nul
title クイズアプリ - サーバー起動

echo ========================================
echo   クイズアプリ サーバー起動
echo ========================================
echo.
echo サーバーを起動しています...
echo.

REM サーバーを起動し、3秒後にブラウザを開く
start /B node server.js

REM サーバーの起動を待つ
timeout /t 3 /nobreak > nul

REM ブラウザでクイズアプリを開く
start http://localhost:10000/quiz-app/

echo.
echo ✓ サーバーが起動しました
echo ✓ ブラウザでクイズアプリを開きました
echo.
echo URL: http://localhost:10000/quiz-app/
echo.
echo ----------------------------------------
echo サーバーを停止するには Ctrl+C を押してください
echo ----------------------------------------
echo.

REM サーバープロセスが終了するまで待機
wait

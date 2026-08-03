@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在启动 avatar 本地网页...
echo.
powershell.exe -ExecutionPolicy Bypass -File "scripts\start-local.ps1"
if %ERRORLEVEL% neq 0 (
    echo.
    echo 启动失败，请查看上方错误信息。
    pause
)

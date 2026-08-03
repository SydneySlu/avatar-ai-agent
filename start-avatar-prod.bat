@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在启动 avatar（生产模式）...
powershell.exe -ExecutionPolicy Bypass -File "scripts\start-production.ps1"
if %ERRORLEVEL% neq 0 (
    echo.
    echo 启动失败，请检查上方错误信息（是否已运行 npm run build？）
    pause
)

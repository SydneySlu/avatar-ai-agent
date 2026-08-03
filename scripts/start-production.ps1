# start-production.ps1 — 生产模式启动（需先 npm run build）
$ErrorActionPreference = "Stop"

Write-Host "=== avatar 生产环境启动 ===" -ForegroundColor Cyan

if (-not (Test-Path ".env.local")) {
    Write-Host "[错误] .env.local 不存在。" -ForegroundColor Red
    exit 1
}

$standalonePath = ".next\standalone\server.js"
if (-not (Test-Path $standalonePath)) {
    Write-Host "[错误] $standalonePath 不存在，请先运行：npm run build" -ForegroundColor Red
    exit 1
}

Write-Host "[信息] 启动生产服务器 http://localhost:3000" -ForegroundColor Green
node $standalonePath

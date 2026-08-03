# start-local.ps1 — 启动 avatar 本地网页
# 运行方式：powershell -ExecutionPolicy Bypass -File scripts\start-local.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== avatar 本地启动检查 ===" -ForegroundColor Cyan

# 1. 检查当前目录
if (-not (Test-Path "package.json")) {
    Write-Host "[错误] 请在 avatar 项目根目录运行本脚本。" -ForegroundColor Red
    exit 1
}

$pkgName = (Get-Content package.json | ConvertFrom-Json).name
if ($pkgName -ne "avatar-broadcaster") {
    Write-Host "[警告] package.json name 不是 avatar-broadcaster，当前为：$pkgName" -ForegroundColor Yellow
}

# 2. 检查 .env.local
if (-not (Test-Path ".env.local")) {
    Write-Host "[错误] .env.local 不存在，请先复制 .env.example 为 .env.local 并填写配置。" -ForegroundColor Red
    exit 1
}

# 3. 读取并检查关键环境变量
$envContent = Get-Content ".env.local" | Where-Object { $_ -match "^[^#]" }
$envMap = @{}
foreach ($line in $envContent) {
    if ($line -match "^(.+?)=(.*)$") {
        $envMap[$Matches[1].Trim()] = $Matches[2].Trim()
    }
}

$missingVars = @()

if (-not $envMap["RELAY_BASE_URL"]) {
    $missingVars += "RELAY_BASE_URL"
}
if (-not $envMap["RELAY_APP_KEY"]) {
    $missingVars += "RELAY_APP_KEY"
}
if (-not $envMap["LLM_API_KEY"]) {
    $missingVars += "LLM_API_KEY"
}

if ($missingVars.Count -gt 0) {
    Write-Host "[警告] .env.local 缺少以下变量，请补充后再启动：" -ForegroundColor Yellow
    foreach ($v in $missingVars) {
        Write-Host "  - $v" -ForegroundColor Yellow
    }
    Write-Host ""
}

# 4. 检查 node_modules
if (-not (Test-Path "node_modules")) {
    Write-Host "[提示] node_modules 不存在，正在执行 npm install..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[错误] npm install 失败。" -ForegroundColor Red
        exit 1
    }
}

# 5. 提示 relay 状态
$relayUrl = $envMap["RELAY_BASE_URL"]
if ($relayUrl) {
    Write-Host "[信息] Relay 地址：$relayUrl（请确认 avatar-relay 已启动）" -ForegroundColor Cyan
}

# 6. 启动
Write-Host ""
Write-Host "=== 启动 npm run dev ===" -ForegroundColor Green
Write-Host "打开浏览器：http://localhost:3000"
Write-Host ""
npm run dev

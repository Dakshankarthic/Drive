# DriveLegal — start Ollama check, DB, backend API, and Expo web
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "=== DriveLegal dev startup ===" -ForegroundColor Cyan

# 1. Ollama
try {
    $null = ollama list 2>$null
    Write-Host "[OK] Ollama is available" -ForegroundColor Green
} catch {
    Write-Host "[WARN] Ollama not found. Start Ollama app, then: ollama pull qwen2.5-coder:7b" -ForegroundColor Yellow
}

# 2. SQLite fines DB
$db = Join-Path $Root "backend\data\fines.db"
if (-not (Test-Path $db)) {
    Write-Host "Creating fines.db ..." -ForegroundColor Yellow
    & "$Root\backend\venv\Scripts\python.exe" -m backend.modules.fines.seed
    & "$Root\backend\venv\Scripts\python.exe" "$Root\backend\scripts\merge_local_dataset.py"
} else {
    Write-Host "[OK] fines.db exists" -ForegroundColor Green
}

# 3. Stop old backend on port 8000 (avoids stale code after updates)
$on8000 = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
if ($on8000) {
    Write-Host "Stopping previous process on port 8000 ..." -ForegroundColor Yellow
    $on8000 | ForEach-Object {
        Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 2
}

# 4. Backend (new window)
Write-Host "Starting backend on http://0.0.0.0:8000 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "Set-Location '$Root'; .\backend\venv\Scripts\python.exe backend\main.py"
)

Start-Sleep -Seconds 3

# 5. Expo web (new window)
Write-Host "Starting Expo web on http://localhost:8081 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "Set-Location '$Root\mobile'; npm run web"
)

Write-Host ""
Write-Host "Open:" -ForegroundColor Green
Write-Host "  App:  http://localhost:8081  (Ask tab for AI chat)"
Write-Host "  API:  http://127.0.0.1:8000/docs"
Write-Host "  Health: http://127.0.0.1:8000/health"
Write-Host ""
Write-Host "Phone on Wi-Fi: set EXPO_PUBLIC_API_HOST to your PC LAN IP in mobile/.env" -ForegroundColor Yellow
Write-Host ""
Write-Host "Demo script: see DEMO_SCRIPT.md in project root" -ForegroundColor Cyan
Write-Host "  1) Set your name: App -> You -> Your profile" -ForegroundColor Gray
Write-Host "  2) Ask: helmet fine Tamil Nadu -> then '5th time?'" -ForegroundColor Gray
Write-Host "  3) Show /health for Ollama + v3-memory" -ForegroundColor Gray

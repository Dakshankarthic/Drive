# DriveLegal — Start Backend and Expo for access ANYWHERE
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "=== DriveLegal remote startup ===" -ForegroundColor Cyan

# 1. Start Backend API
$on8000 = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
if ($on8000) {
    Write-Host "Stopping previous process on port 8000 ..." -ForegroundColor Yellow
    $on8000 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 2
}

Write-Host "Starting local backend on port 8000..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @("-NoExit", "-Command", "Set-Location '$Root'; .\backend\venv\Scripts\python.exe backend\main.py")
Start-Sleep -Seconds 3

# 2. Start Localtunnel for the backend
Write-Host "Starting localtunnel to expose the backend API..." -ForegroundColor Cyan
# Stop any existing localtunnel tasks just in case
Get-CimInstance Win32_Process -Filter "name='node.exe'" | Where-Object { $_.CommandLine -match "localtunnel" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

$tunnelLog = Join-Path $Root "backend_tunnel_$($PID)_$(Get-Random).log"

$tunnelProcess = Start-Process npx.cmd -ArgumentList "--yes", "localtunnel", "--port", "8000" -NoNewWindow -RedirectStandardOutput $tunnelLog -PassThru

# Wait for URL
$tunnelUrl = $null
$attempts = 0
while ($null -eq $tunnelUrl -and $attempts -lt 15) {
    Start-Sleep -Seconds 1
    if (Test-Path $tunnelLog) {
        $logContent = Get-Content $tunnelLog -Raw
        if ($logContent -match "your url is: (https://[^\s]+)") {
            $tunnelUrl = $matches[1]
        }
    }
    $attempts++
}

if ($null -eq $tunnelUrl) {
    Write-Host "[ERROR] Could not start localtunnel. Check backend_tunnel.log" -ForegroundColor Red
    exit
}

Write-Host "[OK] Backend exposed at: $tunnelUrl" -ForegroundColor Green

# 3. Update mobile/.env
$mobileEnv = Join-Path $Root "mobile\.env"
if (Test-Path $mobileEnv) {
    # Remove existing EXPO_PUBLIC_API_URL and EXPO_PUBLIC_API_HOST
    $envContent = Get-Content $mobileEnv | Where-Object { $_ -notmatch "^EXPO_PUBLIC_API_URL" -and $_ -notmatch "^EXPO_PUBLIC_API_HOST" }
    $envContent | Set-Content $mobileEnv
}
Add-Content $mobileEnv "EXPO_PUBLIC_API_URL=$tunnelUrl"
Write-Host "[OK] Updated mobile/.env with backend tunnel URL" -ForegroundColor Green

# 4. Start Expo with tunnel
Write-Host "Starting Expo with tunnel..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @("-NoExit", "-Command", "Set-Location '$Root\mobile'; npx.cmd expo start --tunnel")

Write-Host ""
Write-Host "Everything is running!" -ForegroundColor Green
Write-Host "1. Scan the QR code in the new Expo terminal with your phone's camera (or Expo Go app)."
Write-Host "2. The app will connect to the backend securely through the tunnel."
Write-Host "Note: First API request might take a second as the tunnel wakes up."

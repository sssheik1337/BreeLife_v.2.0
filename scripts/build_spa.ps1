$ErrorActionPreference = 'Stop'

$SpaDir = Join-Path $PSScriptRoot '..\\spa'
if (-not (Test-Path $SpaDir)) {
    Write-Error "SPA directory not found: $SpaDir"
}
Set-Location $SpaDir

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error 'npm not found. Install Node.js (includes npm) before building the SPA.'
}

if (-not (Test-Path 'node_modules')) {
    Write-Host 'Installing SPA dependencies...'
    if (Test-Path 'package-lock.json') {
        npm ci
    } else {
        npm install
    }
}

Write-Host 'Building SPA...'
npm run build

Write-Host 'SPA build complete: spa/dist'

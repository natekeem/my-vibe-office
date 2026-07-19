$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$buildRoot = Join-Path $env:LOCALAPPDATA "Temp\local-agent-office-build-$stamp-$PID"
$releaseRoot = Join-Path (Get-Location) 'release'
New-Item -ItemType Directory -Force -Path $buildRoot, $releaseRoot | Out-Null

Write-Host "Building outside OneDrive: $buildRoot"
& npx electron-builder --win portable "--config.directories.output=$buildRoot"
if ($LASTEXITCODE -ne 0) { throw "electron-builder failed with exit code $LASTEXITCODE" }

$artifact = Get-ChildItem -LiteralPath $buildRoot -File -Filter 'Local-Agent-Office-*.exe' |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
if (-not $artifact) { throw "Portable artifact was not created in $buildRoot" }

$destination = Join-Path $releaseRoot $artifact.Name
Copy-Item -LiteralPath $artifact.FullName -Destination $destination -Force
Write-Host "Created: $destination"
Get-FileHash -LiteralPath $destination -Algorithm SHA256 | Format-List
Write-Host "Temporary build files remain at: $buildRoot"

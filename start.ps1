$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
node .\src\main.mjs --open

# Kill any stale deploy server, then start a fresh one.
$port = 12525
$conns = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if ($conns) {
    $conns | ForEach-Object {
        Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
    }
    Write-Host "Cleared port $port"
}

Set-Location $PSScriptRoot
Write-Host ""
node push-automation.js
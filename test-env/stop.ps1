# Stop everything start.ps1 started. Emulator data (test accounts) is discarded.
# Usage: powershell -File test-env\stop.ps1
. "$PSScriptRoot\common.ps1"

$serial = Get-EmulatorSerial
if ($serial) { & $Adb -s $serial emu kill | Out-Null; Write-Host "Android emulator: stopped ($serial)" }

foreach ($name in 'metro', 'firebase', 'emulator') {
  $pidFile = Join-Path $LogDir "$name.pid"
  if (Test-Path $pidFile) {
    $procId = [int](Get-Content $pidFile)
    # /T kills the child tree (cmd -> node -> java for Firebase, cmd -> node for Metro).
    try { taskkill /PID $procId /T /F 2>$null | Out-Null } catch {}
    Remove-Item $pidFile
    Write-Host "${name}: stopped"
  }
}

# Fallback for anything that outlived its wrapper (e.g. after a crash or reboot):
# our ports' listeners, and emulator processes from this machine's Android SDK.
foreach ($port in $Ports.Values) {
  Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { $pr = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
      if ($pr -and $pr.ProcessName -in 'java', 'node') { Stop-Process -Id $pr.Id -Force; Write-Host "stopped leftover $($pr.ProcessName) on port $port" } }
}
Get-Process -Name 'qemu-system-*', 'emulator' -ErrorAction SilentlyContinue |
  Where-Object { $_.Path -like "$Sdk*" } |
  ForEach-Object { Stop-Process -Id $_.Id -Force; Write-Host "stopped leftover $($_.ProcessName)" }

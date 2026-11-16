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

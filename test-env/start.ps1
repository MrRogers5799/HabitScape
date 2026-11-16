# Start the background test environment (idempotent: skips anything already running).
#   1. Firebase Auth + Firestore emulators  (local test backend, never production)
#   2. Headless Android emulator            (no window, software GPU, low priority)
#   3. adb reverse for Metro and the Firebase ports
#   4. Metro bundler pointed at the emulators
# Usage: powershell -File test-env\start.ps1
. "$PSScriptRoot\common.ps1"

# 1. Firebase emulators
if (Test-Port $Ports.Auth) {
  Write-Host 'Firebase emulators: already running'
} else {
  $projectId = (Select-String -Path (Join-Path $Repo '.env.local') -Pattern '^EXPO_PUBLIC_FIREBASE_PROJECT_ID=(.+)$').Matches[0].Groups[1].Value.Trim()
  Start-Background 'firebase' 'cmd.exe' @('/c', "npx -y $FirebaseCli emulators:start --only auth,firestore --project $projectId") | Out-Null
  Write-Host 'Firebase emulators: starting...'
}

# 2. Headless emulator
if (Get-EmulatorSerial) {
  Write-Host 'Android emulator: already running'
} else {
  Start-Background 'emulator' $EmulatorExe @(
    '-avd', $Avd, '-no-window', '-no-audio', '-no-boot-anim',
    '-gpu', 'swiftshader_indirect', '-cores', '4', '-memory', '2048', '-no-snapshot-save'
  ) | Out-Null
  Write-Host 'Android emulator: booting headless...'
  Wait-Until { Get-EmulatorSerial } 180 'emulator to appear in adb'
}
$serial = Get-EmulatorSerial
Wait-Until { try { (& $Adb -s $serial shell getprop sys.boot_completed 2>$null) -match '1' } catch { $false } } 300 'Android to finish booting'
# Speed up UI driving: no animations.
foreach ($k in 'window_animation_scale','transition_animation_scale','animator_duration_scale') {
  & $Adb -s $serial shell settings put global $k 0 | Out-Null
}
Write-Host "Android emulator: booted ($serial)"

# 3. Port forwarding: 127.0.0.1 on the device -> this machine
foreach ($port in $Ports.Values) { & $Adb -s $serial reverse "tcp:$port" "tcp:$port" | Out-Null }

# 4. Metro, bundling with the emulator backend
if (Test-Port $Ports.Metro) {
  Write-Host 'Metro: already running (restart it with stop.ps1 if it was not started by this script)'
} else {
  # Sentry is switched off in the app when this flag is set (app/_layout.tsx).
  Start-Background 'metro' 'cmd.exe' @('/c', 'npx expo start --localhost --port 8081') @{
    EXPO_PUBLIC_USE_FIREBASE_EMULATOR = '1'
  } | Out-Null
  Write-Host 'Metro: starting...'
}

Wait-Until { (Test-Port $Ports.Auth) -and (Test-Port $Ports.Firestore) } 180 'Firebase emulators'
Wait-Until { Test-Port $Ports.Metro } 120 'Metro'
Write-Host 'Test environment ready.'

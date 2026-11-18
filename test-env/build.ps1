# Build the debug app locally (free: no EAS) and install it on the running emulator.
# Only needed when native code or config changes (new native package, app.json plugins).
# JS-only changes just need the app reloaded: node test-env/drive.mjs reload
# Usage: powershell -File test-env\build.ps1 [-Prebuild]
param([switch]$Prebuild)
. "$PSScriptRoot\common.ps1"

$serial = Get-EmulatorSerial
if (-not $serial) { throw 'No emulator running. Run test-env\start.ps1 first.' }

if ($Prebuild -or -not (Test-Path (Join-Path $Repo 'android\gradlew.bat'))) {
  Write-Host 'Prebuild: syncing android/ with app.json...'
  Push-Location $Repo
  try { npx expo prebuild --platform android --no-install | Out-File (Join-Path $LogDir 'prebuild.log') }
  finally { Pop-Location }
}

$env:SENTRY_DISABLE_AUTO_UPLOAD = 'true'

# Native build outputs land in the repo's node_modules on C:. Don't start if C: is tight.
$freeGb = [math]::Round((Get-PSDrive (Split-Path $Repo -Qualifier).TrimEnd(':')).Free / 1GB, 1)
if ($freeGb -lt 3) { throw "Only $freeGb GB free on $(Split-Path $Repo -Qualifier). A debug build needs about 3 GB; free some space first." }

Write-Host 'Gradle: assembling debug APK (first run takes several minutes)...'
# x86_64 only: the emulator's CPU type. Building all four Android ABIs quadruples native output.
$gradle = Start-Process -FilePath (Join-Path $Repo 'android\gradlew.bat') `
  -ArgumentList @('app:assembleDebug', '--console=plain', '-PreactNativeArchitectures=x86_64') `
  -WorkingDirectory (Join-Path $Repo 'android') -WindowStyle Hidden -PassThru `
  -RedirectStandardOutput (Join-Path $LogDir 'gradle.log') `
  -RedirectStandardError  (Join-Path $LogDir 'gradle.err.log')
$null = $gradle.Handle   # cache the handle so ExitCode is readable after exit
try { $gradle.PriorityClass = 'BelowNormal' } catch {}
$gradle.WaitForExit()
if ($gradle.ExitCode -ne 0) { throw "Gradle failed (exit $($gradle.ExitCode)). See $LogDir\gradle.err.log" }

$apk = Join-Path $Repo 'android\app\build\outputs\apk\debug\app-debug.apk'
& $Adb -s $serial install -r $apk
if ($LASTEXITCODE -ne 0) { throw 'adb install failed' }
Write-Host "Installed $apk on $serial"

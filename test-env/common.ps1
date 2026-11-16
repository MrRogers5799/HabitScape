# Shared settings for the HabitScape background test environment.
# Dot-source from the other scripts: . "$PSScriptRoot\common.ps1"

$ErrorActionPreference = 'Stop'

$Repo        = Split-Path $PSScriptRoot -Parent
$Sdk         = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
$Adb         = Join-Path $Sdk 'platform-tools\adb.exe'
if (-not (Test-Path $Adb)) { $Adb = (Get-Command adb -ErrorAction Stop).Source }
$EmulatorExe = Join-Path $Sdk 'emulator\emulator.exe'
$Avd         = 'Pixel_9'

# Heavy, disposable files live on E: (C: is nearly full): emulator image, Gradle
# cache, temp files, logs, screenshots. Override with HS_TEST_HOME.
$TestHome = if ($env:HS_TEST_HOME) { $env:HS_TEST_HOME } else { 'E:\HabitScapeTestEnv' }
if (-not (Test-Path (Split-Path $TestHome -Qualifier))) { $TestHome = $PSScriptRoot }
$env:HS_TEST_HOME      = $TestHome
$env:ANDROID_HOME      = $Sdk
$env:ANDROID_AVD_HOME  = Join-Path $TestHome 'avd'
$env:GRADLE_USER_HOME  = Join-Path $TestHome 'gradle'
$env:TEMP = $env:TMP   = Join-Path $TestHome 'tmp'
$LogDir      = Join-Path $TestHome 'logs'
$ShotDir     = Join-Path $TestHome 'shots'
New-Item -ItemType Directory -Force $env:TEMP | Out-Null
$FirebaseCli = 'firebase-tools@15.34.0'
$Ports       = @{ Metro = 8081; Auth = 9099; Firestore = 8080 }

New-Item -ItemType Directory -Force $LogDir, $ShotDir | Out-Null

function Test-Port([int]$Port) {
  [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

# Start a hidden, below-normal-priority background process with its output in a log file.
function Start-Background([string]$Name, [string]$File, [string[]]$Arguments, [hashtable]$Env = @{}) {
  foreach ($k in $Env.Keys) { Set-Item "env:$k" $Env[$k] }
  $p = Start-Process -FilePath $File -ArgumentList $Arguments -WorkingDirectory $Repo `
        -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput (Join-Path $LogDir "$Name.log") `
        -RedirectStandardError  (Join-Path $LogDir "$Name.err.log")
  try { $p.PriorityClass = 'BelowNormal' } catch {}
  Set-Content (Join-Path $LogDir "$Name.pid") $p.Id
  return $p
}

function Get-EmulatorSerial {
  (& $Adb devices) -match '^emulator-\d+\s+device' | ForEach-Object { ($_ -split '\s+')[0] } | Select-Object -First 1
}

function Wait-Until([scriptblock]$Condition, [int]$TimeoutSec, [string]$What) {
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    if (& $Condition) { return }
    Start-Sleep -Seconds 2
  }
  throw "Timed out after ${TimeoutSec}s waiting for $What"
}

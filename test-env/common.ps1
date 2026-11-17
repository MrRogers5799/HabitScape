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
  # CreateNoWindow means no console is allocated at all, and child processes
  # (node -> java for Firebase) inherit that. -WindowStyle Hidden isn't enough:
  # with Windows Terminal as the default terminal, children can pop a visible window.
  foreach ($k in $Env.Keys) { Set-Item "env:$k" $Env[$k] }
  # Callers pass either ('cmd.exe', '/c', '<command line>') or (exe, args...).
  if ($File -ieq 'cmd.exe' -and $Arguments[0] -ieq '/c') { $cmdLine = ($Arguments | Select-Object -Skip 1) -join ' ' }
  else { $cmdLine = (@($File) + $Arguments | ForEach-Object { if ($_ -match '\s') { '"' + $_ + '"' } else { $_ } }) -join ' ' }
  $log = Join-Path $LogDir "$Name.log"; $err = Join-Path $LogDir "$Name.err.log"
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = 'cmd.exe'
  # No /s and no wrapping quotes, so cmd never strips quotes from inside the command.
  $psi.Arguments = "/d /c $cmdLine > `"$log`" 2> `"$err`""
  $psi.WorkingDirectory = $Repo
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  $p = [System.Diagnostics.Process]::Start($psi)
  try { $p.PriorityClass = 'BelowNormal' } catch {}
  Set-Content (Join-Path $LogDir "$Name.pid") $p.Id
  return $p
}

# True while an emulator process exists, even before adb reports it ready
# (a cold boot shows as "offline" for minutes). Prevents launching a second one.
function Test-EmulatorRunning {
  [bool](Get-Process -Name 'qemu-system-*' -ErrorAction SilentlyContinue)
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

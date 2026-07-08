param(
  [string]$Key = "",
  [switch]$SkipPipInstall,
  [switch]$SkipFunctionDeploy,
  [switch]$SkipFfmpegInstall
)

$ErrorActionPreference = "Stop"

$AutoInstallFfmpeg = -not $SkipFfmpegInstall

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$logicDir = Join-Path $repoRoot "logic"
$functionsDir = Join-Path $repoRoot "functions"

function Ensure-Ffmpeg {
  param([string]$RepoRoot)

  if (Get-Command "ffmpeg" -ErrorAction SilentlyContinue) {
    Write-Host "ffmpeg found in PATH." -ForegroundColor Green
    return
  }

  if (-not $AutoInstallFfmpeg) {
    throw "ffmpeg not found and SkipFfmpegInstall was enabled."
  }

  Write-Host "ffmpeg not found. Downloading FFmpeg for Windows..." -ForegroundColor Cyan
  $installDir = Join-Path $RepoRoot ".ffmpeg"
  $zipPath = Join-Path $installDir "ffmpeg.zip"

  if (-not (Test-Path $installDir)) {
    New-Item -ItemType Directory -Path $installDir | Out-Null
  }

  # Stable "essentials" build for Windows.
  $url = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"

  Write-Host "Downloading: $url" -ForegroundColor Cyan
  Invoke-WebRequest -Uri $url -OutFile $zipPath

  Write-Host "Extracting FFmpeg..." -ForegroundColor Cyan
  Expand-Archive -Path $zipPath -DestinationPath $installDir -Force

  $ffmpegExe = Get-ChildItem -Path $installDir -Recurse -Filter "ffmpeg.exe" | Select-Object -First 1
  if (-not $ffmpegExe) {
    throw "FFmpeg download/extract succeeded, but ffmpeg.exe was not found in $installDir."
  }

  $ffmpegBinDir = Split-Path -Parent $ffmpegExe.FullName
  $env:Path = "$ffmpegBinDir;$env:Path"
  Write-Host "ffmpeg installed for this session: $ffmpegExe" -ForegroundColor Green
}

if (-not $SkipFunctionDeploy) {
  if (-not (Get-Command "firebase" -ErrorAction SilentlyContinue)) {
    throw "Firebase CLI not found. Install it first: https://firebase.google.com/docs/cli"
  }
}

if (Get-Command "python" -ErrorAction SilentlyContinue) {
  $pythonCmd = "python"
} elseif (Get-Command "py" -ErrorAction SilentlyContinue) {
  $pythonCmd = "py"
} else {
  throw "Python not found. Install Python (https://www.python.org/downloads/) and ensure `python` or `py` is available in PATH."
}

if (-not $Key -or $Key.Trim() -eq "") {
  # Random 40-ish character secret
  $Key = ([guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")).Substring(0, 40)
  Write-Host "Generated LOGIC_API_KEY: $Key" -ForegroundColor Yellow
} else {
  Write-Host "Using provided LOGIC_API_KEY." -ForegroundColor Yellow
}

if (-not $SkipFunctionDeploy) {
  Write-Host "Setting Firebase Functions config: logic.api_key=***" -ForegroundColor Cyan
  Push-Location $repoRoot
  & firebase functions:config:set "logic.api_key=$Key" | Out-Host
  Pop-Location

  Write-Host "Building + deploying Firebase functions (may take a while)..." -ForegroundColor Cyan
  Push-Location $functionsDir
  & npm run build | Out-Host
  & firebase deploy --only functions | Out-Host
  Pop-Location
}

if (-not $SkipPipInstall) {
  Write-Host "Installing Python dependencies (may take a while)..." -ForegroundColor Cyan
  Push-Location $logicDir
  & $pythonCmd -m pip install -r requirements.txt | Out-Host
  Pop-Location
}

Ensure-Ffmpeg -RepoRoot $repoRoot

Write-Host "Starting Python logic service with uvicorn on port 8080..." -ForegroundColor Cyan
Push-Location $logicDir
$env:LOGIC_API_KEY = $Key
& $pythonCmd -m uvicorn main:app --host "0.0.0.0" --port 8080
Pop-Location


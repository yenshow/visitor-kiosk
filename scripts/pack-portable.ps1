#Requires -Version 5.1
<#
.SYNOPSIS
  Pack YSOP Kiosk as Windows installer (YSOP-Kiosk-setup.exe). Staging folder is intermediate only.
#>
[CmdletBinding()]
param(
  [string]$NodeVersion = "20.18.1",
  [switch]$SkipBuild,
  [switch]$SkipManagerBuild
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoRoot

$DistRoot = Join-Path $RepoRoot "dist"
$OutDir = Join-Path $DistRoot "YsopKiosk"
$AppRoot = Join-Path $OutDir "app"
$SetupExe = Join-Path $DistRoot "YSOP-Kiosk-setup.exe"
$CacheDir = Join-Path $DistRoot ".cache"
$PortableSrc = Join-Path $RepoRoot "scripts\portable"
$ManagerProj = Join-Path $RepoRoot "windows\YsopKiosk\YsopKiosk.csproj"
$ManagerPublish = Join-Path $RepoRoot "windows\YsopKiosk\publish"
$Dotnet = $null
foreach ($c in @(
  (Get-Command dotnet -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source),
  "C:\Program Files\dotnet\dotnet.exe"
)) {
  if ($c -and (Test-Path $c)) { $Dotnet = $c; break }
}

$Iscc = $null
foreach ($c in @(
  (Get-Command iscc -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source),
  "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
  "${env:ProgramFiles}\Inno Setup 6\ISCC.exe"
)) {
  if ($c -and (Test-Path -LiteralPath $c)) { $Iscc = $c; break }
}
if (-not $Iscc) {
  throw "Missing Inno Setup 6 (ISCC.exe). Install from https://jrsoftware.org/isinfo.php"
}

Write-Host "==> Repo: $RepoRoot"

if (-not $SkipBuild) {
  Write-Host "==> npm run build..."
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "npm run build failed (exit $LASTEXITCODE)" }
}

$StandaloneDir = Join-Path $RepoRoot ".next\standalone"
if (-not (Test-Path (Join-Path $StandaloneDir "server.js"))) {
  throw "Missing .next\standalone\server.js (need output: 'standalone')."
}

# Node for esbuild / bridge
if (-not (Test-Path $CacheDir)) { New-Item -ItemType Directory -Path $CacheDir | Out-Null }
$CachedNodeDir = Join-Path $CacheDir "node-v$NodeVersion-win-x64"
$CachedNodeExe = Join-Path $CachedNodeDir "node.exe"
if (-not (Test-Path $CachedNodeExe)) {
  $NodeUrl = "https://nodejs.org/dist/v$NodeVersion/node-v$NodeVersion-win-x64.zip"
  $ZipFile = Join-Path $CacheDir "node-v$NodeVersion-win-x64.zip"
  Write-Host "==> Download Node v$NodeVersion ..."
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Invoke-WebRequest -Uri $NodeUrl -OutFile $ZipFile -UseBasicParsing
  Expand-Archive -Path $ZipFile -DestinationPath $CacheDir -Force
}

Write-Host "==> Build yscp-bridge.cjs"
$ToolsDir = Join-Path $RepoRoot "tools"
$BridgeOut = Join-Path $ToolsDir "yscp-bridge.cjs"
New-Item -ItemType Directory -Path $ToolsDir -Force | Out-Null
& $CachedNodeExe (Join-Path $RepoRoot "node_modules\esbuild\bin\esbuild") `
  (Join-Path $RepoRoot "scripts\yscp-bridge.ts") `
  --bundle --platform=node --format=cjs `
  --outfile=$BridgeOut
if ($LASTEXITCODE -ne 0) { throw "esbuild yscp-bridge failed" }

if (-not $SkipManagerBuild) {
  if (-not (Test-Path $Dotnet)) { throw "Missing $Dotnet" }
  Write-Host "==> Publish YsopKiosk..."
  & $Dotnet publish $ManagerProj -c Release -r win-x64 --self-contained true `
    -p:PublishSingleFile=true -o $ManagerPublish
  if ($LASTEXITCODE -ne 0) { throw "dotnet publish failed" }
}
$ManagerExe = Join-Path $ManagerPublish "YsopKiosk.exe"
if (-not (Test-Path $ManagerExe)) { throw "Missing $ManagerExe" }

function Stop-YsopKioskLocks {
  param([string]$Root)
  if (-not (Test-Path -LiteralPath $Root)) { return }

  $rootFull = [IO.Path]::GetFullPath($Root)
  $nodeExe = Join-Path $rootFull "node\node.exe"
  $pidFile = Join-Path $rootFull "runtime\node.pid"
  if (Test-Path -LiteralPath $pidFile) {
    $pidText = (Get-Content -LiteralPath $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
    if ($pidText -match '^\d+$') {
      Stop-Process -Id ([int]$pidText) -Force -ErrorAction SilentlyContinue
    }
    Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
  }

  Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue | ForEach-Object {
    $exe = $_.ExecutablePath
    $cwd = $_.CommandLine
    $hit = $false
    if ($exe -and (Test-Path -LiteralPath $nodeExe) -and
        ([IO.Path]::GetFullPath($exe) -eq [IO.Path]::GetFullPath($nodeExe))) { $hit = $true }
    if ($cwd -and $cwd.IndexOf($rootFull, [StringComparison]::OrdinalIgnoreCase) -ge 0) { $hit = $true }
    if ($hit) { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  }

  Get-Process -Name "YsopKiosk" -ErrorAction SilentlyContinue |
    Where-Object {
      try {
        $p = $_.Path
        $p -and ([IO.Path]::GetFullPath($p) -eq [IO.Path]::GetFullPath((Join-Path $rootFull "YsopKiosk.exe")))
      } catch { $false }
    } |
    Stop-Process -Force -ErrorAction SilentlyContinue

  Start-Sleep -Milliseconds 800
}

function Remove-TreeRetry {
  param([string]$Path, [int]$Attempts = 8)
  if (-not (Test-Path -LiteralPath $Path)) { return }
  for ($i = 1; $i -le $Attempts; $i++) {
    try {
      Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction Stop
      return
    } catch {
      if ($i -eq $Attempts) { throw }
      Write-Host ("    retry remove ({0}/{1}): {2}" -f $i, $Attempts, $_.Exception.Message)
      Stop-YsopKioskLocks -Root $Path
      Start-Sleep -Seconds 1
    }
  }
}

Write-Host "==> Assemble $OutDir"
if (Test-Path $OutDir) {
  Write-Host "==> Stopping processes locking $OutDir (if any)..."
  Stop-YsopKioskLocks -Root $OutDir
  Remove-TreeRetry -Path $OutDir
}
New-Item -ItemType Directory -Path $AppRoot, (Join-Path $OutDir "node"), (Join-Path $OutDir "tools") -Force | Out-Null

Copy-Item (Join-Path $StandaloneDir "*") $AppRoot -Recurse -Force

$dataPath = Join-Path $AppRoot "data"
if (Test-Path $dataPath) { Remove-Item $dataPath -Recurse -Force }
New-Item -ItemType Directory -Path $dataPath -Force | Out-Null

# 清掉 standalone／建置機可能帶入的 env（現場以 YSCP 設定頁全新設定）
foreach ($junk in @(".env", ".env.local", ".env.development", ".env.production", ".env.development.local", ".env.production.local")) {
  $p = Join-Path $AppRoot $junk
  if (Test-Path $p) { Remove-Item $p -Force }
}

$FreshEnv = @"
# YSOP Kiosk portable — 請用 YsopKiosk.exe → YSCP 設定完成
# 勿手動填入建置機金鑰；現場寫入後重啟服務生效
PORT=3010
HOSTNAME=0.0.0.0
"@
$FreshEnvPath = Join-Path $AppRoot ".env"
[System.IO.File]::WriteAllText($FreshEnvPath, $FreshEnv.TrimStart() + "`n", [System.Text.UTF8Encoding]::new($false))
Write-Host "==> Fresh app\.env (no secrets; field YSCP setup)"

$StaticSrc = Join-Path $RepoRoot ".next\static"
if (-not (Test-Path $StaticSrc)) { throw "Missing .next\static" }
$StaticDst = Join-Path $AppRoot ".next\static"
if (Test-Path $StaticDst) { Remove-Item $StaticDst -Recurse -Force }
Copy-Item $StaticSrc $StaticDst -Recurse -Force

foreach ($name in @("public", "content")) {
  $src = Join-Path $RepoRoot $name
  if (-not (Test-Path $src)) { continue }
  $dst = Join-Path $AppRoot $name
  if (Test-Path $dst) { Remove-Item $dst -Recurse -Force }
  Copy-Item $src $dst -Recurse -Force
}

Copy-Item $CachedNodeExe (Join-Path $OutDir "node\node.exe") -Force
Copy-Item (Join-Path $ToolsDir "yscp-bridge.cjs") (Join-Path $OutDir "tools\yscp-bridge.cjs") -Force
$WithIp = Join-Path $RepoRoot "tools\with-client-ip.cjs"
if (-not (Test-Path -LiteralPath $WithIp)) { throw "Missing tools\with-client-ip.cjs" }
Copy-Item -LiteralPath $WithIp -Destination (Join-Path $OutDir "tools\with-client-ip.cjs") -Force
Copy-Item $ManagerExe (Join-Path $OutDir "YsopKiosk.exe") -Force

# 圖示：installer/assets（YSOP.ico＝安裝檔；kiosk.ico＝桌面捷徑／exe）
$AssetsDir = Join-Path $RepoRoot "installer\assets"
$PackageIco = Join-Path $AssetsDir "YSOP.ico"
$ShortcutIco = Join-Path $AssetsDir "kiosk.ico"
if (-not (Test-Path -LiteralPath $PackageIco)) { throw "Missing $PackageIco" }
if (-not (Test-Path -LiteralPath $ShortcutIco)) { throw "Missing $ShortcutIco" }
Copy-Item -LiteralPath $ShortcutIco -Destination (Join-Path $OutDir "kiosk.ico") -Force
$PublicDir = Join-Path $AppRoot "public"
New-Item -ItemType Directory -Path $PublicDir -Force | Out-Null
Copy-Item -LiteralPath $ShortcutIco -Destination (Join-Path $PublicDir "favicon.ico") -Force

Get-ChildItem $PortableSrc -File | ForEach-Object {
  Copy-Item -LiteralPath $_.FullName (Join-Path $OutDir $_.Name) -Force
}

foreach ($req in @(
  "app\server.js", "app\node_modules", "app\package.json", "app\.env",
  "node\node.exe", "tools\yscp-bridge.cjs", "tools\with-client-ip.cjs", "YsopKiosk.exe",
  "kiosk.ico", "README-現場.txt"
)) {
  if (-not (Test-Path -LiteralPath (Join-Path $OutDir $req))) {
    throw "Pack incomplete: $req"
  }
}

# 清除舊 zip（改以安裝檔交付）
$LegacyZip = Join-Path $DistRoot "YsopKiosk.zip"
if (Test-Path -LiteralPath $LegacyZip) { Remove-Item -LiteralPath $LegacyZip -Force }

$Iss = Join-Path $RepoRoot "installer\ysop-kiosk.iss"
Write-Host "==> Inno Setup: $Iscc"
if (Test-Path -LiteralPath $SetupExe) { Remove-Item -LiteralPath $SetupExe -Force }
& $Iscc $Iss
if ($LASTEXITCODE -ne 0) { throw "Inno Setup compile failed" }
if (-not (Test-Path -LiteralPath $SetupExe)) { throw "Missing $SetupExe" }

$SizeMb = [math]::Round((Get-Item -LiteralPath $SetupExe).Length / 1MB, 1)
Write-Host ("Done. {0} ({1} MB)" -f $SetupExe, $SizeMb)
Write-Host "Install with YSOP-Kiosk-setup.exe then open desktop shortcut「YSOP Kiosk」"

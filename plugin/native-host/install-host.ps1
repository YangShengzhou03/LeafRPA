# 轻羽RPA Native Messaging 宿主注册脚本（当前用户，无需管理员）
# 用法：powershell -ExecutionPolicy Bypass -File install-host.ps1
#
# 作用：把 com.leafrpa.browser.json 注册到 HKCU，Chrome 才能拉起 native 宿主。
# 注册后无需重启 Chrome（Chrome 运行时读取注册表）。

$ErrorActionPreference = 'Stop'
$hostDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$manifestPath = Join-Path $hostDir 'com.leafrpa.browser.json'
$regKey = 'HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.leafrpa.browser'

if (-not (Test-Path $manifestPath)) {
    Write-Error "未找到清单文件: $manifestPath"
    exit 1
}

# 读取清单并校验扩展 ID 是否已填写（占位符会导致 Chrome 拒绝连接宿主）
$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$origin = $manifest.allowed_origins[0]
if ($origin -match 'EXTENSION_ID_PLACEHOLDER') {
    Write-Warning "清单 allowed_origins 仍是占位符，请替换为实际扩展 ID。"
    Write-Warning "在 chrome://extensions 中开启开发者模式即可看到扩展 ID。"
}

New-Item -Path $regKey -Force | Out-Null
Set-ItemProperty -Path $regKey -Name '(Default)' -Value $manifestPath

Write-Host "已注册 Native Messaging 宿主: com.leafrpa.browser"
Write-Host "清单: $manifestPath"
Write-Host "allowed_origins: $origin"

# 友好提示：校验 Chrome profile 中扩展的实际 ID
$prefPath = Join-Path $env:LOCALAPPDATA 'Google\Chrome\User Data\Default\Secure Preferences'
if (Test-Path $prefPath) {
    $pref = Get-Content $prefPath -Raw
    $id = ($pref | ConvertFrom-Json).extensions.settings.PSObject.Properties |
        Where-Object { $_.Value.path -like '*leaf-extension*' } |
        Select-Object -First 1 -ExpandProperty Name
    if ($id) {
        Write-Host "检测到已加载的扩展 ID: $id"
        if ($origin -notlike "*$id*") {
            Write-Warning "清单中的 allowed_origins 与该扩展 ID 不一致，Chrome 会拒绝连接宿主！"
            Write-Warning "请把 com.leafrpa.browser.json 里的 allowed_origins 改为 chrome-extension://$id/ 后重新执行本脚本。"
        } else {
            Write-Host "扩展 ID 与清单一致 ✓" -ForegroundColor Green
        }
    } else {
        Write-Warning "未在 Chrome 配置中找到 leaf-extension，请先在 chrome://extensions 加载该扩展。"
    }
}

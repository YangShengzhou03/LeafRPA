# 轻羽 RPA 服务端本地开发脚本（位于 service/backend）
# 用法：powershell -ExecutionPolicy Bypass -File dev.ps1 [init|mysql|app|all]
param(
    [ValidateSet('init', 'mysql', 'app', 'all')]
    [string]$Action = 'all'
)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$rt = Join-Path $here '.runtime'
$jdk = Join-Path $rt 'jdk-18.0.2.1+1'
$mysqlHome = Join-Path $rt 'mysql-8.0.28-winx64'
$dataDir = Join-Path $here 'data\mysql'
$flowDir = Join-Path $here 'data\flows'
$env:JAVA_HOME = $jdk

function Init-Mysql {
    if (-not (Test-Path (Join-Path $mysqlHome 'bin\mysqld.exe'))) {
        throw "未找到便携 MySQL：请先将 mysql.zip 解压到 $mysqlHome"
    }
    if (Test-Path (Join-Path $dataDir 'mysql')) {
        Write-Host '[init] 数据目录已存在，跳过初始化'
        return
    }
    New-Item -ItemType Directory -Force -Path $dataDir, $flowDir | Out-Null
    & (Join-Path $mysqlHome 'bin\mysqld.exe') --initialize-insecure --basedir=$mysqlHome --datadir=$dataDir
    Write-Host '[init] MySQL 数据目录初始化完成（root 无密码）'
}

function Start-Mysql {
    Get-Process mysqld -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Host '[mysql] mysqld 已在运行（PID ' $_.Id '），跳过'
        return
    }
    Start-Process -FilePath (Join-Path $mysqlHome 'bin\mysqld.exe') -ArgumentList @(
        '--basedir=' + $mysqlHome,
        '--datadir=' + $dataDir,
        '--port=13306',
        '--console'
    ) -WindowStyle Hidden
    # 等待端口就绪
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 1
        $ok = (Get-NetTCPConnection -LocalPort 13306 -State Listen -ErrorAction SilentlyContinue) -ne $null
        if ($ok) { break }
    }
    Write-Host '[mysql] MySQL 已启动（127.0.0.1:13306）'
    # 建库授权（幂等）
    $client = Join-Path $mysqlHome 'bin\mysql.exe'
    $sql = "CREATE DATABASE IF NOT EXISTS leaf_rpa DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER IF NOT EXISTS 'leaf'@'%' IDENTIFIED BY 'leaf_rpa_dev'; GRANT ALL PRIVILEGES ON leaf_rpa.* TO 'leaf'@'%'; FLUSH PRIVILEGES;"
    & $client -h 127.0.0.1 -P 13306 -u root -e $sql
    Write-Host '[mysql] 数据库 leaf_rpa 与账号已就绪'
}

function Start-App {
    New-Item -ItemType Directory -Force -Path $flowDir | Out-Null
    $env:LEAF_FLOW_DIR = $flowDir
    & (Join-Path $rt 'apache-maven-3.9.6\bin\mvn.cmd') -f (Join-Path $here 'pom.xml') -DskipTests spring-boot:run
}

switch ($Action) {
    'init'  { Init-Mysql }
    'mysql' { Init-Mysql; Start-Mysql }
    'app'   { Start-App }
    'all'   { Init-Mysql; Start-Mysql; Start-App }
}

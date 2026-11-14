#!/usr/bin/env bash
# 轻羽 RPA 服务端一键部署 / 更新脚本（在服务器上执行）
# 前置条件：仅需要一台装好 Docker（含 compose 插件）的 Linux 服务器。
# 用法：
#   bash deploy-server.sh          # 首次部署或更新到最新镜像
#   bash deploy-server.sh check    # 只准备文件与镜像，不启动（校验环境用）
set -e
cd "$(dirname "$0")"

REPO_RAW="https://gitee.com/Yangshengzhou/leaf-rpa/raw/master/service"

# 1. 准备编排文件（本地没有则从 Gitee 下载，无需克隆整个仓库）
if [ ! -f docker-compose.yml ]; then
  echo "下载 docker-compose.yml ..."
  curl -fsSL "$REPO_RAW/docker-compose.yml" -o docker-compose.yml
fi
mkdir -p sql
if [ ! -f sql/init-db.sql ]; then
  echo "下载 sql/init-db.sql ..."
  curl -fsSL "$REPO_RAW/sql/init-db.sql" -o sql/init-db.sql
fi

# 2. 自动生成 JWT 密钥（已存在则沿用，保证重启后已登录会话不失效）
if [ ! -f .env ] || ! grep -q '^LEAF_JWT_SECRET=' .env 2>/dev/null; then
  if command -v openssl >/dev/null 2>&1; then
    SECRET=$(openssl rand -hex 32)
  else
    SECRET=$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')
  fi
  echo "LEAF_JWT_SECRET=$SECRET" > .env
  echo "已生成随机 JWT 密钥写入 .env"
fi

# 3. 预建虚拟网络（幂等：已存在则跳过）
docker network inspect leaf-rpa-net >/dev/null 2>&1 || docker network create leaf-rpa-net

# 4. 从 Docker Hub 拉取规范镜像（mysql 为官方镜像）
docker compose pull

if [ "$1" = "check" ]; then
  echo "check 结束：文件、密钥、镜像均已就绪，未启动容器"
  exit 0
fi

# 5. 起容器（首次启动 mysql 自动执行 sql/init-db.sql 建表；数据落在命名卷，重启不丢）
docker compose up -d

# 6. 等待健康检查并输出状态
echo "等待服务就绪..."
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1/api/actuator/health >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
docker compose ps
echo "部署完成：入口 http://<服务器IP>/（API 走 /api/ 前缀）"

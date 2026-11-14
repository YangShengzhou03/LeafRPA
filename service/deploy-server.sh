#!/usr/bin/env bash
# 轻羽 RPA 服务端一键部署 / 更新脚本（在服务器上执行）
# 前置条件：仅需要一台装好 Docker（含 compose 插件）的 Linux 服务器。
# 用法：
#   bash deploy-server.sh          # 首次部署或更新到最新镜像
#   bash deploy-server.sh 0.0.0.0  # 可选：只拉取镜像不启动（校验环境用），传任意参数即 dry-run
set -e
cd "$(dirname "$0")"

# 1. 预建虚拟网络（幂等：已存在则跳过）
docker network inspect leaf-rpa-net >/dev/null 2>&1 || docker network create leaf-rpa-net

# 2. 从 Docker Hub 拉取规范镜像（mysql 为官方镜像）
docker compose pull

if [ -n "$1" ]; then
  echo "dry-run 结束：镜像与环境就绪，未启动容器"
  exit 0
fi

# 3. 起容器（首次启动 mysql 自动执行 sql/init-db.sql 建表；数据落在命名卷，重启不丢）
docker compose up -d

# 4. 等待健康检查并输出状态
echo "等待服务就绪..."
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1/api/actuator/health >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
docker compose ps
echo "部署完成：入口 http://<服务器IP>/（API 走 /api/ 前缀）"
echo "生产必须提供 JWT 密钥：echo 'LEAF_JWT_SECRET=<强随机值>' > .env"

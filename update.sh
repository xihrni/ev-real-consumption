#!/bin/bash
# ev-app 代码更新脚本：重新构建镜像并重建容器（数据卷不变）
set -e

APP_DIR=/data/ev-app
COMPOSE=/data/coolify/services/xidu23okwlo2roftbhogivau/docker-compose.yml

echo "==> [1/3] 构建新镜像 ev-app:1.0.0"
cd "$APP_DIR"
DOCKER_BUILDKIT=1 docker build -t ev-app:1.0.0 . 2>&1 | tail -8

echo "==> [2/3] 用新镜像重建容器（数据卷 ev-data 保留）"
docker compose -f "$COMPOSE" up -d --force-recreate

echo "==> [3/3] 健康检查"
sleep 4
curl -s --connect-timeout 5 http://localhost:3000/healthz; echo
docker ps --filter name=ev-app-xidu23okwlo2roftbhogivau --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
echo "完成。访问 https://apc.llw2025.com"

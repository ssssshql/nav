#!/bin/bash

set -e

IMAGE="ssssshql/nav:latest"
CONTAINER_NAME="nav"
PORT=3000
DATA_DIR="/projects/nav"

echo "=== Nav 一键重装脚本 ==="

# 停止并删除现有容器
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "停止并删除旧容器..."
    docker stop $CONTAINER_NAME >/dev/null 2>&1 || true
    docker rm $CONTAINER_NAME >/dev/null 2>&1 || true
fi

# 拉取最新镜像
echo "拉取最新镜像..."
docker pull $IMAGE

# 创建数据目录
mkdir -p $DATA_DIR

# 启动新容器
echo "启动新容器..."
docker run -d --name $CONTAINER_NAME \
    -p $PORT:3000 \
    -v $DATA_DIR:/app/data \
    --restart=always \
    $IMAGE

echo ""
echo "=== 启动成功 ==="
echo "访问地址: http://localhost:$PORT"
echo "数据目录: $DATA_DIR"
echo ""
echo "查看日志: docker logs -f $CONTAINER_NAME"

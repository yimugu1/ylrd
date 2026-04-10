#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ ! -f .env ]]; then
  echo "未找到 .env，从 .env.example 复制；请编辑 .env 后再执行。"
  cp .env.example .env
  exit 1
fi
docker compose up -d --build
echo "已启动。本机: http://127.0.0.1:3000 ；公网请在 Nginx/宝塔 反代 HTTPS。"

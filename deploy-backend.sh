#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="/data/source/fang/backend"
REMOTE_HOST="root@111.229.9.22"
REMOTE_DIR="/www/wwwroot/admin/"
BINARY="fangserver"

echo "==> Building backend..."
cd "$BACKEND_DIR"
go build -o "bin/$BINARY" ./cmd/server/

echo "==> Deploying to $REMOTE_HOST:$REMOTE_DIR..."
rsync -avz "$BACKEND_DIR/bin/$BINARY" "$REMOTE_HOST:$REMOTE_DIR"

echo "==> Uploading start script..."
rsync -avz "$SCRIPT_DIR/start.sh" "$REMOTE_HOST:$REMOTE_DIR"

echo "==> Restarting service..."
ssh "$REMOTE_HOST" "chmod +x ${REMOTE_DIR}${BINARY} ${REMOTE_DIR}start.sh; bash ${REMOTE_DIR}start.sh"

echo "==> Done."

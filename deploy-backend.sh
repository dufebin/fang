#!/bin/bash
set -e

BACKEND_DIR="/data/source/fang/backend"
REMOTE="root@111.229.9.22:/www/wwwroot/admin/"

echo "==> Building backend..."
cd "$BACKEND_DIR"
go build -o bin/server ./cmd/server/

echo "==> Deploying to $REMOTE..."
rsync -avz "$BACKEND_DIR/bin/server" "$REMOTE"

echo "==> Done."

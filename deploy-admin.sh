#!/bin/bash
set -e

ADMIN_DIR="/data/source/fang/frontend/admin"
REMOTE="root@111.229.9.22:/www/wwwroot/guanli.sanjiufangchan.cn/"

echo "==> Building admin..."
cd "$ADMIN_DIR"
npm run build

echo "==> Deploying to $REMOTE..."
rsync -avz --delete --exclude='.user.ini' "$ADMIN_DIR/dist/" "$REMOTE"

echo "==> Done."

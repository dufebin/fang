#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WWW_DIR="$SCRIPT_DIR/www"
REMOTE="root@111.229.9.22:/www/wwwroot/www.sanjiufangchan.cn/"

echo "==> Deploying official site to $REMOTE..."
rsync -avz --delete --exclude='.user.ini' --exclude='.well-known' "$WWW_DIR/" "$REMOTE"

echo "==> Done."

#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
H5_DIR="$SCRIPT_DIR/frontend/h5"
REMOTE="root@111.229.9.22:/www/wwwroot/fang.deephealth.net/"

echo "==> Building H5..."
cd "$H5_DIR"
npm run build

echo "==> Deploying to $REMOTE..."
rsync -avz --delete --exclude='.user.ini' "$H5_DIR/dist/" "$REMOTE"

echo "==> Done."

#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MP_DIR="$SCRIPT_DIR/frontend/miniprogram"
APPID="wx6a8d8faa1f9cc7c8"
KEY_FILE="$MP_DIR/private.${APPID}.key"
REMOTE="root@111.229.9.22"
REMOTE_DIR="/tmp/miniprogram-deploy"

VERSION="${VERSION:-$(date +%Y.%m.%d)}"
DESC="${DESC:-$(git -C "$SCRIPT_DIR" log -1 --pretty=%s 2>/dev/null || echo "自动部署 $(date +%Y-%m-%d)")}"

if [ ! -f "$KEY_FILE" ]; then
  echo "错误: 上传密钥不存在: $KEY_FILE"
  echo "请从微信公众平台下载: 开发 → 开发管理 → 小程序代码上传 → 下载密钥"
  exit 1
fi

echo "==> Syncing miniprogram to $REMOTE..."
ssh "$REMOTE" "rm -rf $REMOTE_DIR && mkdir -p $REMOTE_DIR"
rsync -az --exclude='scripts/' --exclude='node_modules/' --exclude='.git/' \
  "$MP_DIR/" "$REMOTE:$REMOTE_DIR/"

echo "==> Uploading to WeChat (appid: $APPID, version: $VERSION)..."
ssh "$REMOTE" "miniprogram-ci upload \
  --pp $REMOTE_DIR \
  --pkp $REMOTE_DIR/private.${APPID}.key \
  --appid $APPID \
  --uv '$VERSION' \
  -d '$DESC'"

echo "==> Done. Version $VERSION uploaded."

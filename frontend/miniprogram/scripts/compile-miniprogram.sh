#!/usr/bin/env bash
# 使用微信开发者工具 CLI 打开本项目并触发编译（需在工具「设置 → 安全设置」中开启服务端口）。
# 若默认路径找不到 cli，可设置环境变量 WECHAT_DEVTOOLS_CLI 为 cli 可执行文件的绝对路径。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

candidates=(
  "/Applications/wechatwebdevtools.app/Contents/MacOS/cli"
  "/Applications/微信web开发者工具.app/Contents/MacOS/cli"
  "/Applications/微信开发者工具.app/Contents/MacOS/cli"
)

CLI=""
for c in "${candidates[@]}"; do
  if [[ -x "$c" ]]; then
    CLI="$c"
    break
  fi
done

if [[ -z "$CLI" && -n "${WECHAT_DEVTOOLS_CLI:-}" && -x "${WECHAT_DEVTOOLS_CLI}" ]]; then
  CLI="$WECHAT_DEVTOOLS_CLI"
fi

if [[ -z "$CLI" ]]; then
  echo "未找到微信开发者工具 CLI。" >&2
  echo "请安装微信开发者工具，或在 shell 中 export WECHAT_DEVTOOLS_CLI=\"/你的路径/.../cli\"" >&2
  echo "常见路径: /Applications/wechatwebdevtools.app/Contents/MacOS/cli" >&2
  exit 1
fi

exec "$CLI" --lang zh open --project "$ROOT"

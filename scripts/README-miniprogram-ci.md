# 微信小程序上传脚本

使用 miniprogram-ci 实现微信小程序的命令行上传和预览。

## 安装

```bash
# 安装 miniprogram-ci
npm install -g miniprogram-ci

# 或者在项目中安装
npm install --save-dev miniprogram-ci
```

## 配置

### 1. 下载上传密钥

1. 登录[微信小程序管理后台](https://mp.weixin.qq.com/)
2. 开发管理 -> 小程序代码上传
3. 下载密钥文件（名称格式: `private.{APPID}.key`）
4. 将密钥文件放到项目根目录

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并填充：

```bash
cp scripts/.env.example scripts/.env
```

编辑 `.env`：

```bash
WX_APPID=wx1234567890abcdef
WX_PROJECT_PATH=./dist/build/mp-weixin
WX_PRIVATE_KEY_PATH=./private.wx1234567890abcdef.key
```

### 3. 导入脚本到 package.json

将 `package-scripts.json` 中的内容合并到项目的 `package.json` 中。

## 使用

### 基本上传

```bash
# 上传正式版
node scripts/miniprogram-upload.js --version 1.0.0 --desc "首次发布"

# 使用 npm 脚本
npm run wx:upload:prod -- --version 1.0.0 --desc "正式版"
```

### 多环境上传

```bash
# 开发版（不压缩，方便调试）
npm run wx:upload:dev -- --version 1.0.0-beta.1 --desc "新功能测试"

# 测试版
npm run wx:upload:test -- --version 1.0.0-rc.1 --desc "发布前验证"

# 正式版
npm run wx:upload:prod -- --version 1.0.0 --desc "首次发布"
```

### 生成预览二维码

```bash
# 预览首页
npm run wx:preview

# 预览指定页面
npm run wx:preview:page -- --page pages/index/index --query "id=123"
```

## 命令行参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--preview` | 生成预览二维码，不上传 | - |
| `--version <ver>` | 版本号 | 从 package.json 读取 |
| `--desc <text>` | 版本描述 | 自动生成 |
| `--robot <num>` | CI 机器人 (1-30) | 根据环境 |
| `--env <env>` | 环境 (dev/test/prod) | prod |
| `--page <path>` | 预览页面路径 | - |
| `--query <string>` | 预览页面参数 | - |

## 环境配置

| 环境 | 机器人 | 压缩 | 前缀 |
|------|--------|--------|------|
| dev | 2 | 否 | [开发版] |
| test | 3 | 是 | [测试版] |
| prod | 1 | 是 | [正式版] |

## 常见问题

### 1. 上传密钥文件不存在

错误信息：`上传密钥文件不存在`

解决方法：
1. 登录微信小程序后台
2. 开发管理 -> 小程序代码上传
3. 下载密钥文件并放到项目目录

### 2. 项目路径不存在

错误信息：`项目路径不存在`

解决方法：
- 确保已经构建小程序项目
- uniapp: 先运行 `npm run build:mp-weixin`
- 原生小程序: 确保目录包含 project.config.json

### 3. AppID 不正确

错误信息：`请设置小程序 appid`

解决方法：
1. 修改脚本中的 `CONFIG.appid`
2. 或者设置环境变量 `WX_APPID`

## CI/CD 集成

### GitHub Actions 示例

```yaml
name: 微信小程序上传

on:
  push:
    branches: [ main ]

jobs:
  upload:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: 安装依赖
        run: npm install
      
      - name: 构建项目
        run: npm run build:mp-weixin
      
      - name: 上传小程序
        env:
          WX_APPID: ${{ secrets.WX_APPID }}
          WX_PRIVATE_KEY_PATH: ./private.key
        run: |
          echo "${{ secrets.WX_PRIVATE_KEY }}" > private.key
          node scripts/miniprogram-upload.js --version ${{ github.run_number }}
```

## 参考文档

- [miniprogram-ci 官方文档](https://developers.weixin.qq.com/miniprogram/dev/devtools/ci.html)

# 房产中介系统 (Fang)

微信生态房产中介平台，支持房源管理、经纪人认领、个性化分享链接等核心业务。

## 🚀 快速开始

### 前置条件
- Go 1.22+
- Node.js 18+
- MySQL 8.0+
- Redis 7.0+

### 本地开发

```bash
# 后端
cd backend
cp configs/config.yaml.example configs/config.yaml  # 填入配置
go run cmd/server/main.go
# API 监听 :8080

# 前端管理后台
cd frontend/admin
npm install
npm run dev
# 开发服务器 :3001

# 前端 H5
cd frontend/h5
npm install
npm run dev
```

详细文档请查看 [docs/](docs/) 目录：
- [API 文档](docs/API.md)
- [架构说明](docs/ARCHITECTURE.md)
- [部署指南](docs/DEPLOYMENT.md)
- [环境配置](docs/SETUP.md)

---

## 📦 技术栈

### 后端
| 组件 | 选型 |
|------|------|
| 语言 | Go 1.22 |
| Web 框架 | Gin |
| ORM | GORM + MySQL |
| 认证 | JWT (HS256) |
| 缓存 | Redis |
| 微信集成 | OAuth 2.0 + JS-SDK |

### 前端
| 端 | 框架 | UI 组件 |
|------|------|----------|
| 管理后台 | React 18 + TypeScript + Vite | Ant Design 5 |
| H5 移动端 | React 18 + TypeScript + Vite | antd-mobile 5 |
| 微信小程序 | 原生小程序 | - |

---

## ✨ 核心功能

1. **房源管理** - 管理员在后台录入和管理房源信息
2. **经纪人认领** - 经纪人通过微信登录，认领感兴趣的房源
3. **个性化分享** - 生成带经纪人标识的分享链接（`/p/123?a=AGENTCODE`）
4. **微信集成** - 微信 OAuth 登录、JS-SDK 自定义分享卡片
5. **数据统计** - 房源浏览量、经纪人业绩统计

---

## 🏗️ 项目结构

```
fang/
├── backend/              # Go 后端服务
│   ├── cmd/              # 入口程序
│   ├── configs/          # 配置文件
│   ├── internal/         # 业务逻辑
│   │   ├── handler/      # HTTP 处理器
│   │   ├── service/      # 业务逻辑层
│   │   ├── repository/   # 数据访问层
│   │   └── model/        # 数据模型
│   └── pkg/              # 公共包
├── frontend/
│   ├── admin/            # 管理后台 (React + Ant Design)
│   ├── h5/               # H5 移动端 (React + antd-mobile)
│   └── miniprogram/      # 微信小程序
├── docs/                 # 项目文档
└── nginx.conf            # Nginx 配置
```

---

## 📡 API 概览

所有接口前缀为 `/api`，返回统一格式：

```json
{
  "success": true,
  "data": {},
  "error": ""
}
```

主要接口：
- `GET /auth/wechat/redirect` - 微信 OAuth 授权
- `GET /h5/properties` - 房源列表（公开）
- `GET /h5/property/:id` - 房源详情 + 经纪人名片
- `POST /agent/properties/:id/claim` - 经纪人认领房源
- `GET /admin/properties` - 管理员查看所有房源

完整 API 文档 → [docs/API.md](docs/API.md)

---

## 🐳 部署

使用 Docker Compose 编排：

```bash
docker-compose up -d
```

部署架构：
```
Nginx (80)
  ├── /api/         → backend:8080
  ├── /uploads/     → backend:8080
  ├── /h5/          → frontend/h5 (静态文件)
  ├── /admin/       → frontend/admin (静态文件)
  └── /p/           → frontend/h5 (房源分享页)
```

详细部署指南 → [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

---

## 🚢 一键部署脚本

根目录提供四个部署脚本，直接在开发机运行即可完成编译 + 上传：

| 脚本 | 说明 |
|------|------|
| `deploy-backend.sh` | 编译 Go 后端，rsync 到服务器并重启进程 |
| `deploy-admin.sh` | 构建管理后台，rsync 到服务器 |
| `deploy-h5.sh` | 构建 H5 移动端，rsync 到服务器 |
| `deploy-miniprogram.sh` | 编译并上传微信小程序至微信后台 |

```bash
bash deploy-backend.sh
bash deploy-admin.sh
bash deploy-h5.sh
bash deploy-miniprogram.sh
```

**小程序上传说明：**

- 密钥文件 `frontend/miniprogram/private.wx6a8d8faa1f9cc7c8.key` 需提前从微信公众平台下载
  （开发 → 开发管理 → 小程序代码上传 → 下载密钥）
- 上传服务器 IP（`111.229.9.22`）需在微信公众平台 IP 白名单中登记
- 版本号默认取当天日期，描述默认取最新 git commit message，可通过环境变量覆盖：

```bash
VERSION=1.2.0 DESC="修复登录问题" bash deploy-miniprogram.sh
```

上传成功后在微信公众平台 → 版本管理中将其设为体验版进行测试。

---

## 📄 环境变量

敏感配置通过环境变量覆盖（`configs/config.yaml` 为基础配置）：

| 环境变量 | 说明 |
|----------|------|
| `DB_HOST` / `DB_PORT` | MySQL 连接信息 |
| `DB_USER` / `DB_PASSWORD` / `DB_NAME` | 数据库凭证 |
| `REDIS_HOST` / `REDIS_PORT` | Redis 连接信息 |
| `JWT_SECRET` | JWT 签名密钥 |
| `WECHAT_APP_ID` / `WECHAT_APP_SECRET` | 微信凭证 |

---

## 📝 License

MIT License

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！


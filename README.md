# 房产中介系统 (Fangchan)

微信生态房产中介平台，支持房源管理、经纪人认领、个性化分享链接等核心业务。

## 项目概述

核心流程：
1. 管理员在后台录入房源信息
2. 销售经纪人通过微信 OAuth 登录，认领感兴趣的房源
3. 经纪人将个性化链接（如 `/p/123?a=AGENTCODE`）分享给客户
4. 客户打开链接，在查看房源详情的同时，看到该经纪人的名片（姓名、电话、微信二维码）

---

## 技术栈

### 后端
| 组件 | 选型 |
|------|------|
| 语言 | Go 1.25 |
| Web 框架 | Gin v1.12 |
| ORM | GORM + MySQL 驱动 |
| 认证 | JWT (HS256，72 小时有效期) |
| 缓存 | Redis（缓存微信 access_token 和 JS-SDK ticket）|
| 微信集成 | 自定义 HTTP 客户端（OAuth 2.0 + JS-SDK）|
| 文件存储 | 本地文件系统（预留腾讯 COS 接口）|
| 配置 | YAML + 环境变量覆盖 |

### 前端 Admin（后台管理）
| 组件 | 选型 |
|------|------|
| 框架 | React 18 + TypeScript |
| 构建 | Vite 6 |
| UI | Ant Design 5 + ProComponents |
| 状态 | Zustand 5 |
| 路由 | React Router v6 |
| HTTP | Axios |

### 前端 H5（微信端）
| 组件 | 选型 |
|------|------|
| 框架 | React 18 + TypeScript |
| 构建 | Vite 6 |
| UI | antd-mobile 5 |
| 状态 | Zustand 5（持久化至 localStorage）|
| 路由 | React Router v6 |
| 微信 | JS-SDK 自定义分享卡片 |

---

## 目录结构

```
fangchan/
├── backend/
│   ├── cmd/server/main.go       # 入口，路由注册
│   ├── configs/config.yaml      # 配置文件
│   ├── internal/
│   │   ├── config/              # YAML 配置加载
│   │   ├── model/               # GORM 数据模型
│   │   ├── repository/          # 数据库查询层
│   │   ├── service/             # 业务逻辑层
│   │   ├── handler/             # HTTP 处理层
│   │   └── middleware/          # JWT 认证中间件
│   └── pkg/
│       ├── wechat/              # 微信 OAuth + JS-SDK 客户端
│       ├── storage/             # 本地文件存储
│       └── response/            # 统一 JSON 响应工具
├── frontend/
│   ├── admin/                   # 后台管理 SPA
│   └── h5/                      # 微信端 H5 SPA
└── nginx.conf                   # Nginx 反向代理配置
```

---

## 数据模型

### users — 微信用户
| 字段 | 类型 | 说明 |
|------|------|------|
| id | uint | 主键 |
| openid | string | 微信唯一标识（唯一索引）|
| unionid | string | 微信 UnionID |
| nickname | string | 微信昵称 |
| avatar_url | string | 头像地址 |
| role | enum | `admin` / `agent` / `user` |
| phone | string | 手机号 |

### agents — 经纪人资料
| 字段 | 类型 | 说明 |
|------|------|------|
| id | uint | 主键 |
| user_id | uint | 关联 users.id |
| name | string | 姓名 |
| phone | string | 联系电话 |
| wechat_id | string | 微信号 |
| wechat_qr_url | string | 微信二维码图片 |
| agent_code | string | 6 位唯一邀请码（用于分享链接）|
| status | enum | `active` / `inactive` |

### properties — 房源
| 字段 | 类型 | 说明 |
|------|------|------|
| id | uint | 主键 |
| title | string | 房源标题 |
| property_type | enum | `新房` / `二手房` / `租房` / `商铺` |
| city / district / address | string | 位置信息 |
| total_price | float | 总价（万元）|
| unit_price | float | 单价（元/㎡）|
| monthly_rent | float | 月租金（元，租房用）|
| area | float | 建筑面积（㎡）|
| bedrooms / living_rooms / bathrooms | int | 户型 |
| floor / total_floors | int | 楼层 |
| decoration | enum | `毛坯` / `简装` / `精装` / `豪华装修` |
| cover_image | string | 封面图 |
| status | enum | `available` / `sold` / `rented` / `offline` |
| view_count | int | 浏览次数 |

### agent_properties — 认领关系（多对多）
| 字段 | 类型 | 说明 |
|------|------|------|
| agent_id | uint | 经纪人 ID |
| property_id | uint | 房源 ID |
| claimed_at | time | 认领时间 |

### property_views — 访问记录
| 字段 | 类型 | 说明 |
|------|------|------|
| property_id | uint | 房源 ID |
| agent_id | uint | 来源经纪人（可为空）|
| viewer_openid | string | 访客 openid |
| ip | string | 访客 IP |

---

## API 文档

所有接口前缀为 `/api`，返回统一格式：

```json
{
  "success": true,
  "data": {},
  "error": ""
}
```

### 认证接口（无需 Token）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/auth/wechat/redirect` | 跳转微信 OAuth 授权页 |
| GET | `/auth/wechat/callback` | 微信 code 换取 JWT |
| GET | `/auth/me` | 获取当前用户信息（需 Token）|

### H5 公开接口（无需 Token）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/h5/properties` | 房源列表（支持类型、区域、关键词、价格筛选）|
| GET | `/h5/property/:id` | 房源详情 + 经纪人名片（`?a=AGENTCODE`）|
| GET | `/h5/agent/:agent_code` | 经纪人主页 + 其认领的房源 |
| GET | `/h5/wechat/jssdk-config` | 获取微信 JS-SDK 签名配置 |

### 经纪人接口（需 Token，role: agent 或 admin）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/agent/profile` | 获取/创建自己的经纪人资料 |
| PUT | `/agent/profile` | 更新资料 |
| GET | `/agent/properties` | 我认领的房源 |
| GET | `/agent/all-properties` | 全部房源（用于认领）|
| POST | `/agent/properties` | 新增房源 |
| POST | `/agent/properties/:id/claim` | 认领房源 |
| DELETE | `/agent/properties/:id/claim` | 取消认领 |
| POST | `/agent/properties/:id/images` | 上传房源图片 |

### 管理员接口（需 Token，role: admin）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/admin/properties` | 所有房源列表 |
| POST | `/admin/properties` | 新增房源 |
| POST | `/admin/properties/:id/images` | 上传图片 |
| PUT | `/admin/properties/:id/status` | 修改房源状态 |
| GET | `/admin/agents` | 经纪人列表 |
| POST | `/admin/agents` | 创建经纪人（传 user_id）|
| PUT | `/admin/agents/:id/status` | 启用/禁用经纪人 |

---

## 认证流程

```
用户访问 H5
    ↓
跳转微信 OAuth（snsapi_userinfo scope）
    ↓
微信回调 /api/auth/wechat/callback?code=...
    ↓
后端换取 access_token，拉取用户信息（nickname, avatar, openid）
    ↓
upsert users 表，签发 JWT（payload: user_id, open_id, role）
    ↓
客户端存入 localStorage，后续请求携带 Authorization: Bearer <token>
```

**Token 失效处理：** H5 Axios 拦截器收到 401 时自动重定向至微信 OAuth 流程。

**管理员账号：** 手动将目标用户在 `users` 表中的 `role` 改为 `admin`。

---

## 微信分享机制

H5 使用 `useWechatShare` Hook：
1. 调用 `/api/h5/wechat/jssdk-config?url=<当前页URL>` 获取签名
2. 调用 `wx.config()` 注入 JS-SDK
3. 调用 `wx.updateAppMessageShareData()` 和 `wx.updateTimelineShareData()`，使分享卡片包含经纪人姓名和房源图片

---

## 前端页面

### Admin（`/admin/`）

| 路径 | 说明 |
|------|------|
| `/admin` | 仪表盘：统计卡片（总房源、在售房源、总经纪人、活跃经纪人）|
| `/admin/properties` | 房源管理：筛选、新增、图片上传、上/下架 |
| `/admin/agents` | 经纪人管理：新增、启用/禁用、复制分享链接 |

### H5（`/h5/` 和 `/p/`）

| 路径 | 说明 |
|------|------|
| `/p/:id` | 房源详情页（分享目标页）：图片库、价格规格、位置、经纪人名片 |
| `/agent/:agent_code` | 经纪人主页：资料 + 无限滚动房源列表 |
| `/properties` | 房源列表：搜索、类型筛选、无限滚动 |
| `/login` | 微信 OAuth 回调处理 |

---

## 部署架构

```
Nginx (port 80)
  /api/         →  backend:8080   (Go API)
  /uploads/     →  backend:8080   (静态文件)
  /h5/          →  /html/h5/      (H5 SPA)
  /p/           →  /html/h5/      (房源分享短链，同 SPA)
  /admin/       →  /html/admin/   (Admin SPA)
```

后端使用 Docker 多阶段构建（`golang:1.22-alpine` 构建 → `alpine` 运行时），与 Nginx、MySQL、Redis 一起通过 Docker Compose 编排。

---

## 配置说明

`configs/config.yaml` 为基础配置，所有敏感字段支持环境变量覆盖：

| 环境变量 | 说明 |
|----------|------|
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | MySQL 连接信息 |
| `REDIS_HOST` / `REDIS_PORT` | Redis 连接信息 |
| `JWT_SECRET` | JWT 签名密钥 |
| `WECHAT_APP_ID` / `WECHAT_APP_SECRET` | 微信公众号/小程序凭证 |

---

## 本地开发

### 后端

```bash
cd backend
cp configs/config.yaml.example configs/config.yaml  # 填入配置
go run cmd/server/main.go
# 监听 :8080
```

### 前端 Admin

```bash
cd frontend/admin
npm install
npm run dev
# 开发服务器 :3001
```

### 前端 H5

```bash
cd frontend/h5
npm install
npm run dev
```

### 文件上传

上传的文件存储在 `backend/uploads/` 目录下，按 `年/月` 组织（如 `uploads/2026/04/`）。

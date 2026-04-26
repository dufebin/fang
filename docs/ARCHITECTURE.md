# 系统架构说明

## 整体架构

```
┌─────────────────────────────────────────────┐
│                   客户端                      │
│  ┌──────────────┐     ┌───────────────────┐  │
│  │ Admin SPA    │     │  H5 SPA (微信端)  │  │
│  │ React + AntD │     │  React + antd-mob │  │
│  └──────┬───────┘     └────────┬──────────┘  │
└─────────┼────────────────────┼──────────────┘
          │                    │
          ▼                    ▼
┌─────────────────────────────────────────────┐
│                  Nginx                       │
│  /admin/  →  /html/admin/ (静态文件)         │
│  /h5/     →  /html/h5/   (静态文件)         │
│  /p/      →  /html/h5/   (分享短链)         │
│  /api/    →  backend:8080 (反向代理)         │
│  /uploads →  backend:8080 (静态资源)         │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────┐
│              Go Backend (Gin)                │
│  ┌──────────┐  ┌─────────┐  ┌────────────┐ │
│  │ Handler  │→ │ Service │→ │ Repository │ │
│  └──────────┘  └─────────┘  └─────┬──────┘ │
│                                    │        │
│  ┌──────────┐  ┌─────────┐         │        │
│  │   JWT    │  │  WeChat │         │        │
│  │Middleware│  │  Client │         │        │
│  └──────────┘  └─────────┘         │        │
└────────────────────────────────────┼────────┘
                                     │
              ┌──────────────────────┤
              │                      │
              ▼                      ▼
     ┌────────────────┐    ┌─────────────────┐
     │     MySQL      │    │      Redis       │
     │  (业务数据)    │    │  (微信 Token 缓  │
     └────────────────┘    │   存 + JS Ticket)│
                           └─────────────────┘
```

---

## 后端分层架构

### 目录结构

```
backend/
├── cmd/server/main.go        # 程序入口：初始化依赖、注册路由
├── configs/
│   └── config.yaml           # 基础配置（支持 $ENV 变量展开）
├── internal/                 # 内部包，外部不可引用
│   ├── config/               # 配置加载（YAML + 环境变量覆盖）
│   ├── model/                # GORM 数据模型定义
│   ├── repository/           # 数据访问层（SQL 查询封装）
│   ├── service/              # 业务逻辑层
│   ├── handler/              # HTTP 请求处理层
│   └── middleware/           # 中间件（JWT 鉴权、角色校验）
└── pkg/                      # 可复用包
    ├── wechat/               # 微信 OAuth 2.0 + JS-SDK 客户端
    ├── storage/              # 文件存储（本地 / COS 预留接口）
    └── response/             # 统一 HTTP 响应工具
```

### 分层职责

```
请求
 │
 ▼
Middleware（JWT 解析、角色校验）
 │
 ▼
Handler（参数绑定、参数校验、调用 Service、返回响应）
 │
 ▼
Service（业务规则、事务、调用 Repository 和外部 SDK）
 │
 ▼
Repository（GORM 查询封装，返回 Model 结构体）
 │
 ▼
MySQL
```

**规则：**
- Handler 不直接操作数据库
- Service 不感知 HTTP 上下文（gin.Context）
- Repository 只封装 SQL，不含业务判断

---

## 数据模型关系

```
users (微信用户)
  │  1:1
  └── agents (经纪人资料)
        │  M:N  (通过 agent_properties)
        └── properties (房源)
              │  1:N
              └── property_images (房源图片)

property_views (浏览记录)
  ├── → properties
  └── → agents (可为空，记录来源经纪人)
```

---

## 认证与授权架构

### 认证流程

```
H5 客户端
    │ 1. 用户点击登录
    ▼
GET /api/auth/wechat/redirect
    │ 2. 302 跳转微信授权页
    ▼
微信服务器（snsapi_userinfo scope）
    │ 3. 用户同意，微信回调
    ▼
GET /api/auth/wechat/callback?code=xxx
    │ 4. 后端用 code 换 access_token
    │ 5. 拉取用户信息（openid, nickname, avatar）
    │ 6. upsert users 表
    │ 7. 签发 JWT（HS256，72h 有效）
    ▼
客户端收到 JWT，存入 localStorage
    │ 8. 后续请求携带 Authorization: Bearer <token>
    ▼
Middleware 解析 JWT → 注入 user_id, role 至 gin.Context
```

### 角色权限矩阵

| 资源 | user | agent | admin |
|------|------|-------|-------|
| H5 公开接口 | ✓ | ✓ | ✓ |
| 经纪人资料管理 | ✗ | ✓ | ✓ |
| 认领 / 取消认领房源 | ✗ | ✓ | ✓ |
| 上传图片 | ✗ | ✓ | ✓ |
| 管理员接口 | ✗ | ✗ | ✓ |

---

## 微信集成架构

### OAuth 登录

```
H5 → GET /auth/wechat/redirect
   → 302 to https://open.weixin.qq.com/connect/oauth2/authorize
   → 微信回调 /auth/wechat/callback?code=xxx
   → 后端调用微信接口换取 access_token + 用户信息
   → 签发系统 JWT
```

### JS-SDK 自定义分享

```
H5 页面加载
   │
   ▼
GET /api/h5/wechat/jssdk-config?url=<当前页URL>
   │ 后端：
   │   1. 从 Redis 获取 jsapi_ticket（过期则重新拉取并缓存）
   │   2. 生成签名（sha1(string1)）
   │   3. 返回 appId + timestamp + nonceStr + signature
   ▼
前端调用 wx.config() 注入 SDK
   ▼
wx.updateAppMessageShareData({
  title: "经纪人姓名 - 房源标题",
  desc: "...",
  link: "https://xxx/p/123?a=AGENTCODE",
  imgUrl: "封面图"
})
```

Redis 缓存策略：
- `wechat:access_token` — TTL 7000s（微信有效期 7200s）
- `wechat:jsapi_ticket` — TTL 7000s

---

## 文件存储架构

```
POST /api/*/properties/:id/images
  multipart/form-data (image file)
    │
    ▼
pkg/storage/LocalStorage
    │ 按日期分目录：uploads/{year}/{month}/{uuid}.{ext}
    ▼
./uploads/ (挂载至 Docker 卷)
    │
    ▼
Nginx: /uploads/ → backend:8080/uploads/ (反向代理静态文件)
```

预留接口：配置文件中包含腾讯 COS 字段（`secret_id`, `secret_key`, `bucket`, `region`），切换存储只需实现 `Storage` 接口。

---

## 前端架构

### Admin SPA

```
frontend/admin/src/
├── pages/
│   ├── Dashboard/       # 统计概览
│   ├── Properties/      # 房源管理（ProTable + ModalForm）
│   └── Agents/          # 经纪人管理
├── stores/              # Zustand 全局状态
├── api/                 # Axios 封装（统一拦截 401 跳转登录）
└── components/          # 共享组件
```

### H5 SPA

```
frontend/h5/src/
├── pages/
│   ├── PropertyDetail/  # 房源详情 + 经纪人名片（/p/:id）
│   ├── PropertyList/    # 房源列表（无限滚动）
│   ├── AgentHome/       # 经纪人主页（/agent/:code）
│   └── Login/           # OAuth 回调处理
├── components/
│   ├── PropertyCard/    # 房源卡片
│   ├── AgentCard/       # 经纪人名片
│   └── ImageGallery/    # 图片画廊
├── hooks/
│   └── useWechatShare   # JS-SDK 分享配置 Hook
├── stores/              # Zustand（userStore 持久化至 localStorage）
└── api/                 # Axios 封装（401 自动重走 OAuth）
```

### 路由约定

| 路径 | 说明 |
|------|------|
| `/p/:id` | 房源详情（分享落地页，等同 `/h5/property/:id`）|
| `/h5/properties` | 房源列表 |
| `/agent/:agent_code` | 经纪人主页 |
| `/login` | OAuth 回调处理页 |
| `/admin` | 后台管理（独立 SPA）|

---

## 部署架构

```
Internet
    │ HTTPS (443)
    ▼
Nginx (反向代理 + 静态托管)
    ├── /admin/    → /html/admin/ dist 目录
    ├── /h5/ + /p/ → /html/h5/ dist 目录
    ├── /api/      → backend:8080
    └── /uploads/  → backend:8080
    │
    ▼ Docker 内网
Go Backend (port 8080)
    ├── MySQL (port 3306)
    ├── Redis (port 6379)
    └── ./uploads/ (Docker 卷挂载)
```

Docker Compose 服务名：`backend`、`mysql`、`redis`、`nginx`。

---

## 关键设计决策

**1. JWT 无状态认证**
服务端不存储 Session，水平扩展友好。代价是 Token 在 72h 内无法主动吊销。

**2. agent_code 分享链接**
经纪人通过 6 位随机码标识自己（如 `AB3X9Z`），分享 URL 格式为 `/p/:propertyId?a=:agentCode`。后端根据 `agent_code` 查找经纪人并记录来源，同时附带该经纪人名片。

**3. Redis 缓存微信凭证**
微信 `access_token` 和 `jsapi_ticket` 每天只允许获取有限次数，必须缓存。TTL 略小于微信官方有效期（7200s → 7000s），避免边界问题。

**4. 本地文件存储**
当前阶段使用本地文件系统，通过 Docker 卷持久化。`pkg/storage` 定义了存储接口，后续切换 COS 只需实现该接口并修改依赖注入。

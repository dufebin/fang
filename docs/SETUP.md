# 安装配置指南

## 环境要求

| 工具 | 最低版本 | 说明 |
|------|----------|------|
| Go | 1.22 | 后端运行时 |
| Node.js | 18 | 前端构建 |
| MySQL | 8.0 | 主数据库 |
| Redis | 6.0 | 缓存 |
| Docker | 20.x | 容器化部署（可选）|

---

## 一、克隆项目

```bash
git clone <repo_url>
cd fangchan
```

---

## 二、后端配置

### 2.1 配置文件

复制并修改配置文件：

```bash
cp backend/configs/config.yaml backend/configs/config.local.yaml
```

编辑 `config.yaml`，填入真实值：

```yaml
server:
  port: 8080
  mode: debug          # debug | release

database:
  host: 127.0.0.1
  port: 3306
  user: root
  password: your_password
  dbname: fangchan
  charset: utf8mb4

redis:
  host: 127.0.0.1
  port: 6379
  password: ""
  db: 0

jwt:
  secret: your_jwt_secret_at_least_32_chars
  expire_hours: 72

wechat:
  app_id: wx_your_app_id
  app_secret: your_app_secret

storage:
  type: local
  local_path: ./uploads

# 腾讯 COS（可选，type 改为 cos 时生效）
cos:
  secret_id: ""
  secret_key: ""
  bucket: ""
  region: ""
```

### 2.2 环境变量（推荐用于生产环境）

所有敏感配置均可通过环境变量覆盖，优先级高于配置文件：

```bash
export DB_HOST=127.0.0.1
export DB_PORT=3306
export DB_USER=root
export DB_PASSWORD=your_password
export DB_NAME=fangchan

export REDIS_HOST=127.0.0.1
export REDIS_PORT=6379

export JWT_SECRET=your_jwt_secret_at_least_32_chars

export WECHAT_APP_ID=wx_your_app_id
export WECHAT_APP_SECRET=your_app_secret
```

### 2.3 初始化数据库

创建数据库：

```sql
CREATE DATABASE fangchan CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

启动后端时 GORM 会自动执行 `AutoMigrate` 建表，无需手动执行 SQL。

### 2.4 创建管理员账号

1. 先通过微信 OAuth 正常登录一次，系统会自动创建 `users` 记录
2. 在数据库中将目标用户的 `role` 改为 `admin`：

```sql
UPDATE users SET role = 'admin' WHERE openid = 'your_openid';
```

---

## 三、前端配置

### 3.1 Admin 前端

```bash
cd frontend/admin
npm install
```

创建环境变量文件：

```bash
cp .env.example .env.local
```

编辑 `.env.local`：

```env
VITE_API_BASE_URL=http://localhost:8080/api
```

### 3.2 H5 前端

```bash
cd frontend/h5
npm install
```

创建环境变量文件：

```bash
cp .env.example .env.local
```

编辑 `.env.local`：

```env
VITE_API_BASE_URL=http://localhost:8080/api
```

> **微信 OAuth 限制：** 微信 OAuth 授权需要已备案的域名，本地开发时可使用内网穿透工具（如 ngrok、frp）将 `localhost` 暴露为公网域名，并在微信公众号后台添加为授权回调域名。

---

## 四、微信公众号配置

在 [微信公众平台](https://mp.weixin.qq.com) 完成以下配置：

### 4.1 网页授权

路径：开发 → 接口权限 → 网页服务 → 网页授权

添加授权回调域名（不含 `http://`）：

```
your-domain.com
```

### 4.2 JS-SDK 安全域名

路径：设置与开发 → 公众号设置 → 功能设置

添加 JS 接口安全域名：

```
your-domain.com
```

### 4.3 获取 AppID 和 AppSecret

路径：设置与开发 → 基本配置

将 `AppID` 和 `AppSecret` 填入配置文件或环境变量。

---

## 五、本地启动

### 5.1 启动后端

```bash
cd backend
go run cmd/server/main.go
# 服务监听 http://localhost:8080
```

验证服务正常：

```bash
curl http://localhost:8080/api/h5/properties
```

### 5.2 启动 Admin 前端

```bash
cd frontend/admin
npm run dev
# 开发服务器 http://localhost:3001
```

### 5.3 启动 H5 前端

```bash
cd frontend/h5
npm run dev
# 开发服务器 http://localhost:5173
```

---

## 六、目录权限

确保上传目录有写入权限：

```bash
mkdir -p backend/uploads
chmod 755 backend/uploads
```

---

## 七、常见问题

**Q: 启动时报 `dial tcp ... connection refused`**

检查 MySQL 和 Redis 服务是否启动，以及 `config.yaml` 中的连接配置是否正确。

**Q: 微信 OAuth 报 `redirect_uri 参数错误`**

检查微信公众号后台的授权回调域名是否已配置，且与实际访问域名完全一致（含路径规则）。

**Q: 图片上传后无法访问**

确认 Nginx（或反向代理）已正确配置 `/uploads/` 路由，指向后端服务的静态文件目录。

**Q: JWT 认证失败**

确认客户端请求头格式为 `Authorization: Bearer <token>`，注意 `Bearer ` 后有一个空格。

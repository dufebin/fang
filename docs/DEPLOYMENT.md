# 部署说明

## 部署架构概览

```
Internet (HTTPS 443)
    │
    ▼
Nginx
  ├─ /admin/    → Admin SPA 静态文件
  ├─ /h5/       → H5 SPA 静态文件
  ├─ /p/        → H5 SPA 静态文件（房源短链）
  ├─ /api/      → Go Backend :8080
  └─ /uploads/  → Go Backend :8080（静态资源）
    │
    ▼ Docker 内网
  ┌──────────────────────────┐
  │  Go Backend (:8080)      │
  │  MySQL (:3306)           │
  │  Redis (:6379)           │
  │  uploads/ (Docker 卷)    │
  └──────────────────────────┘
```

---

## 一、构建前端

### Admin

```bash
cd frontend/admin
npm install
npm run build
# 产物：frontend/admin/dist/
```

### H5

```bash
cd frontend/h5
npm install
npm run build
# 产物：frontend/h5/dist/
```

---

## 二、构建后端 Docker 镜像

```bash
cd backend
docker build -t fangchan-backend:latest .
```

`Dockerfile` 使用多阶段构建：

```dockerfile
# 阶段 1：编译
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o fangchan-server cmd/server/main.go

# 阶段 2：运行时（最小化镜像）
FROM alpine:latest
WORKDIR /app
COPY --from=builder /app/fangchan-server .
COPY configs/ configs/
EXPOSE 8080
CMD ["./fangchan-server"]
```

---

## 三、Docker Compose 部署

在项目根目录创建 `docker-compose.yml`：

```yaml
version: "3.9"

services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_PASSWORD}
      MYSQL_DATABASE: fangchan
      MYSQL_CHARSET: utf8mb4
    volumes:
      - mysql_data:/var/lib/mysql
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped

  backend:
    image: fangchan-backend:latest
    environment:
      DB_HOST: mysql
      DB_PORT: 3306
      DB_USER: root
      DB_PASSWORD: ${DB_PASSWORD}
      DB_NAME: fangchan
      REDIS_HOST: redis
      REDIS_PORT: 6379
      JWT_SECRET: ${JWT_SECRET}
      WECHAT_APP_ID: ${WECHAT_APP_ID}
      WECHAT_APP_SECRET: ${WECHAT_APP_SECRET}
    volumes:
      - uploads_data:/app/uploads
    depends_on:
      - mysql
      - redis
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./frontend/admin/dist:/html/admin:ro
      - ./frontend/h5/dist:/html/h5:ro
      - ./ssl:/etc/nginx/ssl:ro          # SSL 证书目录
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  mysql_data:
  uploads_data:
```

创建 `.env` 文件（放在 `docker-compose.yml` 同目录）：

```bash
DB_PASSWORD=your_strong_password
JWT_SECRET=your_jwt_secret_at_least_32_chars
WECHAT_APP_ID=wx_your_app_id
WECHAT_APP_SECRET=your_app_secret
```

启动所有服务：

```bash
docker compose up -d
```

---

## 四、Nginx 配置

项目已提供 `nginx.conf`，核心配置如下：

```nginx
upstream backend {
    server backend:8080;
}

server {
    listen 80;
    server_name your-domain.com;

    # Admin 后台
    location /admin/ {
        root /html;
        try_files $uri $uri/ /admin/index.html;
    }

    # H5 房源列表 / 经纪人主页
    location /h5/ {
        root /html;
        try_files $uri $uri/ /h5/index.html;
    }

    # 房源分享短链（/p/:id）→ 同一个 H5 SPA 处理
    location /p/ {
        root /html/h5;
        try_files $uri $uri/ /h5/index.html;
    }

    # API 反向代理
    location /api/ {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # 上传文件静态服务
    location /uploads/ {
        proxy_pass http://backend;
    }
}
```

### HTTPS 配置（推荐）

使用 Let's Encrypt 申请证书：

```bash
apt install certbot python3-certbot-nginx
certbot --nginx -d your-domain.com
```

或在 Nginx 中手动配置：

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate     /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    # 其余配置同上
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}
```

---

## 五、数据库初始化

首次启动后端服务时，GORM AutoMigrate 会自动建表。可通过以下命令验证：

```bash
docker compose exec mysql mysql -u root -p fangchan -e "SHOW TABLES;"
```

预期输出包含：`users`、`agents`、`properties`、`property_images`、`agent_properties`、`property_views`

---

## 六、创建第一个管理员

```bash
# 1. 先通过微信 OAuth 正常登录，记录 openid
# 2. 执行 SQL
docker compose exec mysql mysql -u root -p fangchan \
  -e "UPDATE users SET role='admin' WHERE openid='your_openid';"
```

---

## 七、运维操作

### 查看日志

```bash
# 后端日志
docker compose logs -f backend

# Nginx 访问日志
docker compose logs -f nginx
```

### 重启服务

```bash
docker compose restart backend
```

### 更新部署

```bash
# 重新构建后端镜像
cd backend && docker build -t fangchan-backend:latest .

# 重新构建前端
cd frontend/admin && npm run build
cd frontend/h5 && npm run build

# 重启服务（Nginx 会自动加载新的静态文件）
docker compose up -d --force-recreate backend
```

### 数据备份

```bash
# 备份 MySQL
docker compose exec mysql mysqldump -u root -p fangchan > backup_$(date +%Y%m%d).sql

# 备份上传文件
docker run --rm -v fangchan_uploads_data:/uploads \
  -v $(pwd):/backup alpine \
  tar czf /backup/uploads_$(date +%Y%m%d).tar.gz /uploads
```

---

## 八、上线前检查清单

- [ ] MySQL 和 Redis 服务正常运行
- [ ] 微信公众号授权回调域名已配置
- [ ] 微信 JS 接口安全域名已配置
- [ ] `JWT_SECRET` 已设置为高强度随机字符串（≥32 位）
- [ ] HTTPS 证书已配置并自动续签
- [ ] `uploads/` 目录使用 Docker 卷持久化
- [ ] 数据库已完成初始备份
- [ ] 管理员账号已创建
- [ ] Nginx `server_name` 已替换为真实域名
- [ ] `.env` 文件不在版本控制中（`.gitignore` 已排除）

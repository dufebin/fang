# API 接口文档

Base URL: `http://<host>/api`

所有接口返回统一 JSON 格式：

```json
{
  "success": true,
  "data": {},
  "error": ""
}
```

分页接口额外返回：

```json
{
  "success": true,
  "data": {
    "list": [],
    "total": 100,
    "page": 1,
    "page_size": 20
  }
}
```

---

## 认证说明

需要认证的接口，请求头携带：

```
Authorization: Bearer <JWT_TOKEN>
```

JWT 有效期 72 小时，过期后需重新通过微信 OAuth 登录。

角色权限层级：
- `user` — 普通访客
- `agent` — 经纪人（可认领房源、上传图片）
- `admin` — 管理员（全部权限）

---

## 一、认证接口

### 1.1 微信 OAuth 授权跳转

```
GET /auth/wechat/redirect
```

将用户重定向至微信授权页面（`snsapi_userinfo` scope）。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| redirect_uri | query | string | 否 | 授权成功后的回跳地址 |

**响应**

HTTP 302 重定向至微信授权页。

---

### 1.2 微信 OAuth 回调

```
GET /auth/wechat/callback
```

微信授权完成后自动回调，完成用户信息同步并签发 JWT。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| code | query | string | 是 | 微信授权码（一次性）|
| state | query | string | 否 | 原始 state 参数 |

**响应**

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGci...",
    "user": {
      "id": 1,
      "openid": "oXxx...",
      "nickname": "张三",
      "avatar_url": "https://...",
      "role": "agent"
    }
  }
}
```

---

### 1.3 获取当前用户信息

```
GET /auth/me
```

**认证：** 需要 Token

**响应**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "openid": "oXxx...",
    "nickname": "张三",
    "avatar_url": "https://...",
    "role": "agent",
    "phone": "138xxxx8888"
  }
}
```

---

## 二、H5 公开接口

无需登录即可访问。

### 2.1 房源列表

```
GET /h5/properties
```

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| type | query | string | 否 | 房源类型：`新房` / `二手房` / `租房` / `商铺` |
| district | query | string | 否 | 行政区 |
| keyword | query | string | 否 | 关键词（标题/地址模糊搜索）|
| min_price | query | float | 否 | 最低总价（万元）|
| max_price | query | float | 否 | 最高总价（万元）|
| status | query | string | 否 | 状态，默认返回 `available` |
| page | query | int | 否 | 页码，默认 1 |
| page_size | query | int | 否 | 每页条数，默认 20 |

**响应**

```json
{
  "success": true,
  "data": {
    "list": [
      {
        "id": 1,
        "title": "朝阳三居室精装修",
        "property_type": "二手房",
        "city": "北京",
        "district": "朝阳",
        "address": "望京 SOHO",
        "total_price": 580.0,
        "unit_price": 82000,
        "area": 95.5,
        "bedrooms": 3,
        "living_rooms": 1,
        "bathrooms": 2,
        "cover_image": "/uploads/2026/04/xxx.jpg",
        "status": "available",
        "view_count": 128
      }
    ],
    "total": 56,
    "page": 1,
    "page_size": 20
  }
}
```

---

### 2.2 房源详情

```
GET /h5/property/:id
```

访问时自动记录浏览行为（`property_views`）。

**路径参数**

| 参数 | 类型 | 说明 |
|------|------|------|
| id | int | 房源 ID |

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| a | query | string | 否 | 经纪人 `agent_code`，携带时附带经纪人名片 |

**响应**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "朝阳三居室精装修",
    "property_type": "二手房",
    "city": "北京",
    "district": "朝阳",
    "address": "望京 SOHO",
    "total_price": 580.0,
    "unit_price": 82000,
    "monthly_rent": null,
    "area": 95.5,
    "bedrooms": 3,
    "living_rooms": 1,
    "bathrooms": 2,
    "floor": 18,
    "total_floors": 28,
    "decoration": "精装",
    "direction": "南",
    "description": "拎包入住，南北通透...",
    "cover_image": "/uploads/2026/04/cover.jpg",
    "images": [
      { "url": "/uploads/2026/04/img1.jpg", "sort_order": 1 }
    ],
    "status": "available",
    "view_count": 129,
    "agent": {
      "id": 5,
      "name": "李四",
      "phone": "139xxxx0000",
      "wechat_id": "lisi_wechat",
      "wechat_qr_url": "/uploads/2026/04/qr.jpg",
      "avatar_url": "/uploads/2026/04/avatar.jpg",
      "agent_code": "AB3X9Z",
      "bio": "从业 10 年，专注朝阳区豪宅"
    }
  }
}
```

> `agent` 字段仅当传入有效 `?a=AGENTCODE` 时返回。

---

### 2.3 经纪人主页

```
GET /h5/agent/:agent_code
```

**路径参数**

| 参数 | 类型 | 说明 |
|------|------|------|
| agent_code | string | 经纪人 6 位唯一码 |

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| page | query | int | 否 | 页码，默认 1 |
| page_size | query | int | 否 | 每页条数，默认 20 |

**响应**

```json
{
  "success": true,
  "data": {
    "agent": {
      "id": 5,
      "name": "李四",
      "phone": "139xxxx0000",
      "wechat_id": "lisi_wechat",
      "wechat_qr_url": "/uploads/2026/04/qr.jpg",
      "avatar_url": "/uploads/2026/04/avatar.jpg",
      "agent_code": "AB3X9Z",
      "bio": "从业 10 年，专注朝阳区豪宅"
    },
    "properties": {
      "list": [],
      "total": 12,
      "page": 1,
      "page_size": 20
    }
  }
}
```

---

### 2.4 微信 JS-SDK 签名

```
GET /h5/wechat/jssdk-config
```

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| url | query | string | 是 | 当前页面完整 URL（用于签名）|

**响应**

```json
{
  "success": true,
  "data": {
    "app_id": "wx...",
    "timestamp": 1745488800,
    "nonce_str": "abc123",
    "signature": "sha1_hash..."
  }
}
```

---

## 三、经纪人接口

**认证：** 需要 Token，角色 `agent` 或 `admin`

### 3.1 获取经纪人资料

```
GET /agent/profile
```

首次调用时若无资料，自动创建并生成唯一 `agent_code`。

**响应**

```json
{
  "success": true,
  "data": {
    "id": 5,
    "user_id": 3,
    "name": "李四",
    "phone": "139xxxx0000",
    "wechat_id": "lisi_wechat",
    "wechat_qr_url": "/uploads/2026/04/qr.jpg",
    "avatar_url": "/uploads/2026/04/avatar.jpg",
    "agent_code": "AB3X9Z",
    "bio": "从业 10 年",
    "status": "active"
  }
}
```

---

### 3.2 更新经纪人资料

```
PUT /agent/profile
```

**请求体**

```json
{
  "name": "李四",
  "phone": "139xxxx0000",
  "wechat_id": "lisi_wechat",
  "bio": "从业 10 年，专注朝阳区豪宅",
  "avatar_url": "/uploads/2026/04/avatar.jpg",
  "wechat_qr_url": "/uploads/2026/04/qr.jpg"
}
```

所有字段均为可选（PATCH 语义）。

---

### 3.3 我认领的房源

```
GET /agent/properties
```

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| page | query | int | 否 | 页码 |
| page_size | query | int | 否 | 每页条数 |

---

### 3.4 全部房源（用于认领）

```
GET /agent/all-properties
```

返回所有状态为 `available` 的房源，包含当前用户是否已认领的标记。

---

### 3.5 新增房源

```
POST /agent/properties
```

**请求体**

```json
{
  "title": "朝阳三居室精装修",
  "property_type": "二手房",
  "city": "北京",
  "district": "朝阳",
  "address": "望京 SOHO",
  "total_price": 580.0,
  "unit_price": 82000,
  "area": 95.5,
  "bedrooms": 3,
  "living_rooms": 1,
  "bathrooms": 2,
  "floor": 18,
  "total_floors": 28,
  "decoration": "精装",
  "direction": "南",
  "description": "拎包入住，南北通透"
}
```

---

### 3.6 认领房源

```
POST /agent/properties/:id/claim
```

**路径参数**

| 参数 | 类型 | 说明 |
|------|------|------|
| id | int | 房源 ID |

---

### 3.7 取消认领

```
DELETE /agent/properties/:id/claim
```

---

### 3.8 上传房源图片

```
POST /agent/properties/:id/images
```

**请求体**：`multipart/form-data`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| image | file | 是 | 图片文件（jpg/png/webp）|
| sort_order | int | 否 | 排序序号，默认 0 |

**响应**

```json
{
  "success": true,
  "data": {
    "url": "/uploads/2026/04/xxx.jpg"
  }
}
```

---

## 四、管理员接口

**认证：** 需要 Token，角色 `admin`

### 4.1 房源列表

```
GET /admin/properties
```

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| type | query | string | 否 | 房源类型 |
| status | query | string | 否 | 状态 |
| keyword | query | string | 否 | 关键词 |
| page | query | int | 否 | 页码 |
| page_size | query | int | 否 | 每页条数 |

---

### 4.2 新增房源

```
POST /admin/properties
```

请求体同 [3.5 新增房源](#35-新增房源)。

---

### 4.3 上传房源图片

```
POST /admin/properties/:id/images
```

请求体同 [3.8 上传房源图片](#38-上传房源图片)。

---

### 4.4 修改房源状态

```
PUT /admin/properties/:id/status
```

**请求体**

```json
{
  "status": "offline"
}
```

可选值：`available` / `sold` / `rented` / `offline`

---

### 4.5 经纪人列表

```
GET /admin/agents
```

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| status | query | string | 否 | `active` / `inactive` |
| keyword | query | string | 否 | 姓名/手机号搜索 |
| page | query | int | 否 | 页码 |
| page_size | query | int | 否 | 每页条数 |

---

### 4.6 创建经纪人

```
POST /admin/agents
```

**请求体**

```json
{
  "user_id": 3,
  "name": "李四",
  "phone": "139xxxx0000",
  "wechat_id": "lisi_wechat"
}
```

> 需先确认目标用户已通过微信登录（`users` 表中存在记录）。

---

### 4.7 修改经纪人状态

```
PUT /admin/agents/:id/status
```

**请求体**

```json
{
  "status": "inactive"
}
```

可选值：`active` / `inactive`

---

## 五、错误码

| HTTP 状态码 | success | 场景 |
|-------------|---------|------|
| 200 | true | 请求成功 |
| 400 | false | 请求参数错误 |
| 401 | false | Token 缺失或已过期 |
| 403 | false | 权限不足（角色不满足要求）|
| 404 | false | 资源不存在 |
| 500 | false | 服务器内部错误 |

错误响应示例：

```json
{
  "success": false,
  "error": "房源不存在"
}
```

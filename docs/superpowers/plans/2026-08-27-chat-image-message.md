# 聊天发送图片功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 微信小程序 C2C 聊天支持发送图片消息（相册/拍照），后端消息表加 `type` 字段区分文本与图片。

**Architecture:** 后端 `ChatMessage` 模型加 `Type` 字段（`varchar(20) default 'text'`，GORM AutoMigrate 加列）；`SendMessage` 接收并校验 `type`；`GetConversations` 会话列表对图片消息显示 `[图片]`。前端复用现成 `upload()` + `POST /user/upload/image` 上传拿 URL，再以 `type:'image'` 发消息；聊天页输入栏加"+"按钮，气泡按 `type` 条件渲染 `<image mode="widthFix">`，点击 `wx.previewImage` 全屏预览，长按复用现有删除逻辑。

**Tech Stack:** Go 1.x / Gin / GORM + MySQL（后端）；微信小程序原生（前端）。

## Global Constraints

- 后端模块路径 `fangchan`，handler 包 `fangchan/internal/handler`，model 包 `fangchan/internal/model`。
- 数据库为远程 MySQL（dev config `configs/config.yaml` host=111.229.9.22 port=3306）。GORM `AutoMigrate` 在服务启动时运行（`cmd/server/main.go:45`，`ChatMessage` 已在 :61），新增 `Type` 列会直接作用到 dev 库。
- 本地服务端口 `9080`，API 前缀 `/api`，base URL `http://localhost:9080/api`。
- 响应统一为 `{code, message, data}`，handler 用 `response.Success/BadRequest/ServerError/Fail`（见 `pkg/response`）。
- 提交信息风格沿用仓库：`feat(chat): ...` / `feat(miniprogram): ...`。
- **测试方式：后端全仓无 `_test.go`、前端无单测框架。本计划采用手动验证（curl + 开发者工具），不引入测试框架。** 每个 Task 的 "Verify" 步骤即其测试环节。

## 验证环境准备（每个后端 Task 复用）

```bash
export BASE_URL=http://localhost:9080/api
# 取 dev mock 经纪人 token（固定用户 dev_mock_agent_001）
export TOKEN=$(curl -s -XPOST $BASE_URL/dev/mock-agent-login | jq -r .data.token)
# 取一个联系人作为 to_user_id（排除自己的任一用户）
export PEER=$(curl -s $BASE_URL/chat/contacts -H "Authorization: Bearer $TOKEN" | jq -r '.data[0].id')
```

启动本地后端：`cd backend && go run ./cmd/server`（首次启动会 AutoMigrate 加 `type` 列）。

---

### Task 1: 后端 ChatMessage 加 Type 字段

**Files:**
- Modify: `backend/internal/model/chat.go:5-20`

**Interfaces:**
- Consumes: 无
- Produces: `model.ChatMessage.Type` 字段（json `type`，DB `varchar(20) NOT NULL DEFAULT 'text'`）；常量 `model.MsgTypeText="text"`、`model.MsgTypeImage="image"`。后续 Task 2/3 与前端依赖此。

- [ ] **Step 1: 加 Type 字段到 ChatMessage**

修改 `backend/internal/model/chat.go`，在 `Content` 字段后插入 `Type`：

```go
type ChatMessage struct {
	ID             uint64     `gorm:"primaryKey;autoIncrement" json:"id"`
	FromUserID     uint64     `gorm:"not null;index:idx_chat_from;index:idx_chat_conv" json:"from_user_id"`
	ToUserID       uint64     `gorm:"not null;index:idx_chat_to;index:idx_chat_conv" json:"to_user_id"`
	Content        string     `gorm:"type:varchar(500);not null" json:"content"`
	Type           string     `gorm:"type:varchar(20);not null;default:text" json:"type"`
	IsRead         bool       `gorm:"not null;default:false" json:"is_read"`
	ReadAt         *time.Time `gorm:"index" json:"-"`
	DeletedForFrom bool       `gorm:"not null;default:false" json:"-"`
	DeletedForTo   bool       `gorm:"not null;default:false" json:"-"`
	CreatedAt      time.Time  `gorm:"index" json:"created_at"`

	FromUser *User `gorm:"foreignKey:FromUserID" json:"from_user,omitempty"`
	ToUser   *User `gorm:"foreignKey:ToUserID" json:"to_user,omitempty"`
}
```

- [ ] **Step 2: 加消息类型常量**

在同一文件 `TableName()` 函数后追加常量：

```go
func (ChatMessage) TableName() string { return "chat_messages" }

const (
	MsgTypeText  = "text"
	MsgTypeImage = "image"
)
```

- [ ] **Step 3: 编译验证**

Run: `cd backend && go build ./...`
Expected: 无错误输出，退出码 0。

- [ ] **Step 4: 启动服务触发迁移并校验列**

Run: `cd backend && go run ./cmd/server`（待启动完成，日志无 "数据库迁移失败"），另开终端：

```bash
# 远程 dev MySQL（用 configs/config.yaml 的账密）
mysql -h111.229.9.22 -P3306 -ufang -p<pwd> fangchan -e "SHOW COLUMNS FROM chat_messages LIKE 'type';"
```
Expected: 一行 `type | varchar(20)`，Default 为 `text`。现有行的 `type` 自动回填为 `text`。停掉服务（Ctrl-C）。

- [ ] **Step 5: Commit**

```bash
git add backend/internal/model/chat.go
git commit -m "feat(chat): ChatMessage 增加 type 字段区分消息类型"
```

---

### Task 2: 后端 SendMessage 接收并校验 type

**Files:**
- Modify: `backend/internal/handler/chat_handler.go:149-177`

**Interfaces:**
- Consumes: `model.MsgTypeText`、`model.MsgTypeImage`、`model.ChatMessage.Type`（来自 Task 1）。
- Produces: `POST /chat/messages` 接受 `{to_user_id, content, type?}`，`type` 缺省 `text`，非法返 400；返回的 `ChatMessage` 带 `type` 字段。前端 Task 4/5 依赖此契约。

- [ ] **Step 1: 改造 SendMessage 请求体与校验**

修改 `backend/internal/handler/chat_handler.go` 的 `SendMessage`（:149）：

```go
// SendMessage POST /chat/messages
func (h *ChatHandler) SendMessage(c *gin.Context) {
	me := middleware.GetCurrentUserID(c)
	var req struct {
		ToUserID uint64 `json:"to_user_id" binding:"required"`
		Content  string `json:"content" binding:"required,max=500"`
		Type     string `json:"type"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}
	if req.ToUserID == me {
		response.BadRequest(c, "不能给自己发消息")
		return
	}
	msgType := req.Type
	if msgType == "" {
		msgType = model.MsgTypeText
	}
	if msgType != model.MsgTypeText && msgType != model.MsgTypeImage {
		response.BadRequest(c, "不支持的消息类型")
		return
	}

	msg := model.ChatMessage{
		FromUserID: me,
		ToUserID:   req.ToUserID,
		Content:    req.Content,
		Type:       msgType,
	}
	if err := h.db.Create(&msg).Error; err != nil {
		response.ServerError(c, err)
		return
	}
	var fromUser model.User
	h.db.Select("id, nickname, avatar_url").First(&fromUser, me)
	msg.FromUser = &fromUser
	response.Success(c, msg)
}
```

- [ ] **Step 2: 编译验证**

Run: `cd backend && go build ./... && go vet ./...`
Expected: 无错误。

- [ ] **Step 3: 启动服务并取测试 token/peer**

```bash
cd backend && go run ./cmd/server &
sleep 3
export BASE_URL=http://localhost:9080/api
export TOKEN=$(curl -s -XPOST $BASE_URL/dev/mock-agent-login | jq -r .data.token)
export PEER=$(curl -s $BASE_URL/chat/contacts -H "Authorization: Bearer $TOKEN" | jq -r '.data[0].id')
echo "TOKEN=$TOKEN PEER=$PEER"
```

- [ ] **Step 4: 验证发图片消息（type=image）**

```bash
URL="https://fapi.deephealth.net/uploads/2026/08/test-image.jpg"
curl -s -XPOST $BASE_URL/chat/messages \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"to_user_id\":$PEER,\"content\":\"$URL\",\"type\":\"image\"}" | jq
```
Expected: `code:0`，`data.type == "image"`，`data.content == URL`。

- [ ] **Step 5: 验证不传 type 默认 text（向后兼容）**

```bash
curl -s -XPOST $BASE_URL/chat/messages \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"to_user_id\":$PEER,\"content\":\"hello\"}" | jq '.data.type'
```
Expected: `"text"`。

- [ ] **Step 6: 验证非法 type 返 400**

```bash
curl -s -XPOST $BASE_URL/chat/messages \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"to_user_id\":$PEER,\"content\":\"x\",\"type\":\"video\"}" | jq
```
Expected: `code != 0`，message 含 "不支持的消息类型"。

- [ ] **Step 7: 验证 GetMessages 返回带 type**

```bash
curl -s "$BASE_URL/chat/messages?peer_id=$PEER&page=1" \
  -H "Authorization: Bearer $TOKEN" | jq '.data[-1] | {type, content}'
```
Expected: 最后一条 `type` 与 `content` 对应正确（image/url 或 text/hello）。

- [ ] **Step 8: Commit**

```bash
git add backend/internal/handler/chat_handler.go
git commit -m "feat(chat): SendMessage 支持 type 字段并校验"
```

（保持后端服务运行，Task 3 复用。）

---

### Task 3: 后端 GetConversations 图片消息显示 [图片]

**Files:**
- Modify: `backend/internal/handler/chat_handler.go:41-104`（仅改 :52-70 的 raw SQL 子查询）

**Interfaces:**
- Consumes: `model.MsgTypeImage`（Task 1）。
- Produces: `GET /chat/conversations` 对最后一条为图片消息的会话，`last_message` 返回 `[图片]` 而非 URL。

- [ ] **Step 1: 改造 last_msg 子查询**

修改 `backend/internal/handler/chat_handler.go` 的 `GetConversations`，把 :54-57 的 `SELECT content FROM chat_messages m2 ...` 子查询替换为 `CASE WHEN m2.type='image' THEN '[图片]' ELSE m2.content END`：

```go
var rows []convRow
if err := h.db.Raw(`
	SELECT peer_id,
	       (SELECT CASE WHEN m2.type = 'image' THEN '[图片]' ELSE m2.content END
	        FROM chat_messages m2
	        WHERE ((m2.from_user_id = ? AND m2.to_user_id = peer_id AND m2.deleted_for_from = false)
	           OR (m2.from_user_id = peer_id AND m2.to_user_id = ? AND m2.deleted_for_to = false))
	        ORDER BY m2.created_at DESC LIMIT 1) AS last_msg,
	       MAX(created_at) AS last_at,
	       SUM(CASE WHEN from_user_id = peer_id AND to_user_id = ? AND is_read = false AND deleted_for_to = false THEN 1 ELSE 0 END) AS unread
	FROM (
	    SELECT CASE WHEN from_user_id = ? THEN to_user_id ELSE from_user_id END AS peer_id,
	           created_at,
	           from_user_id, to_user_id, is_read, deleted_for_to
	    FROM chat_messages
	    WHERE (from_user_id = ? AND deleted_for_from = false)
	       OR (to_user_id = ? AND deleted_for_to = false)
	) t
	GROUP BY peer_id
	ORDER BY last_at DESC
`, me, me, me, me, me, me).Scan(&rows).Error; err != nil {
	response.ServerError(c, err)
	return
}
```

（参数占位符数量与原 SQL 一致：6 个 `?`，顺序不变。）

- [ ] **Step 2: 编译验证**

Run: `cd backend && go build ./...`
Expected: 无错误。

- [ ] **Step 3: 重启服务**

```bash
# 停掉 Task 2 的服务进程（Ctrl-C 或 kill），重新启动
cd backend && go run ./cmd/server &
sleep 3
# 重新取 token/peer
export BASE_URL=http://localhost:9080/api
export TOKEN=$(curl -s -XPOST $BASE_URL/dev/mock-agent-login | jq -r .data.token)
export PEER=$(curl -s $BASE_URL/chat/contacts -H "Authorization: Bearer $TOKEN" | jq -r '.data[0].id')
# 确保最后一条是图片消息
URL="https://fapi.deephealth.net/uploads/2026/08/test-image.jpg"
curl -s -XPOST $BASE_URL/chat/messages -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"to_user_id\":$PEER,\"content\":\"$URL\",\"type\":\"image\"}" >/dev/null
```

- [ ] **Step 4: 验证会话列表 last_message 为 [图片]**

```bash
curl -s $BASE_URL/chat/conversations -H "Authorization: Bearer $TOKEN" | jq '.data[] | {peer_id, last_message}'
```
Expected: 与 PEER 对应的那条 `last_message == "[图片]"`（不再是 URL）。

- [ ] **Step 5: Commit**

```bash
git add backend/internal/handler/chat_handler.go
git commit -m "feat(chat): 会话列表图片消息显示为[图片]"
```

（后端三步完成，可停掉服务。）

---

### Task 4: 前端 渲染与预览图片消息

**Files:**
- Modify: `frontend/miniprogram/api/chat.js:1,15-17,35`（`sendMessage` 加 `type` 参数，导出不变）
- Modify: `frontend/miniprogram/pages/chat/index.wxml:15-20`（气泡条件渲染）
- Modify: `frontend/miniprogram/pages/chat/index.wxss`（加 `.bubble-image`）
- Modify: `frontend/miniprogram/pages/chat/index.js`（加 `onPreviewImage`）

**Interfaces:**
- Consumes: 后端 Task 1/2（消息对象含 `type`）。
- Produces: 聊天页能渲染 `type==='image'` 消息为图片气泡并点击全屏预览；`sendMessage(toUserId, content, type)` 签名（Task 5 依赖）。

- [ ] **Step 1: api/chat.js 的 sendMessage 加 type 参数**

修改 `frontend/miniprogram/api/chat.js` 的 `sendMessage`：

```js
function sendMessage(toUserId, content, type) {
  return request({ url: '/chat/messages', method: 'POST', data: { to_user_id: toUserId, content: content, type: type || 'text' } })
}
```

（`module.exports` 末行无需改动——`sendMessage` 已在导出列表。）

- [ ] **Step 2: 气泡按 type 条件渲染**

修改 `frontend/miniprogram/pages/chat/index.wxml` 的 bubble（:15-20）：

```xml
<view class="bubble {{item.is_mine ? 'bubble-mine' : 'bubble-peer'}}"
      bindtouchstart="onBubbleTouchStart" bindtouchend="onBubbleTouchEnd" bindtouchcancel="onBubbleTouchEnd"
      data-id="{{item.id}}">
  <image wx:if="{{item.type==='image'}}" class="bubble-image"
         src="{{item.content}}" mode="widthFix"
         bindtap="onPreviewImage" data-url="{{item.content}}" />
  <text wx:else class="bubble-text">{{item.content}}</text>
</view>
```

- [ ] **Step 3: 加图片气泡样式**

在 `frontend/miniprogram/pages/chat/index.wxss` 末尾追加：

```css
/* 图片消息气泡 */
.bubble-image {
  width: 400rpx;
  max-width: 60vw;
  border-radius: 16rpx;
  display: block;
  background: #f4f6f8;
}
```

（`mode="widthFix"` 会按图片真实比例自适应高度，无需指定高。）

- [ ] **Step 4: 加 onPreviewImage 方法**

在 `frontend/miniprogram/pages/chat/index.js` 的 `Page({ ... })` 中，`onSend` 方法之后、`})` 之前加入：

```js
  onPreviewImage(e) {
    const url = e.currentTarget.dataset.url
    const urls = this.data.messages.filter(m => m.type === 'image').map(m => m.content)
    if (urls.length === 0) return
    wx.previewImage({ urls: urls, current: url })
  },
```

- [ ] **Step 5: 验证渲染与预览（开发者工具）**

1. 启动后端（`cd backend && go run ./cmd/server`）。
2. 微信开发者工具打开 `frontend/miniprogram`，登录（用 dev mock 登录或真实微信）。
3. 先用 curl 给当前登录用户与某 peer 各发一条图片消息（确保 DB 有 image 消息）：
   ```bash
   export BASE_URL=http://localhost:9080/api
   export TOKEN=$(curl -s -XPOST $BASE_URL/dev/mock-agent-login | jq -r .data.token)
   export PEER=$(curl -s $BASE_URL/chat/contacts -H "Authorization: Bearer $TOKEN" | jq -r '.data[0].id')
   URL="https://fapi.deephealth.net/uploads/2026/08/test-image.jpg"
   curl -s -XPOST $BASE_URL/chat/messages -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"to_user_id\":$PEER,\"content\":\"$URL\",\"type\":\"image\"}" >/dev/null
   ```
4. 进聊天页（与 peer 的会话）：图片消息以图片气泡显示，文本消息仍为文本气泡。
5. 点击图片气泡 → 全屏预览；有多张时可左右滑动。
6. 长按图片气泡 → 弹删除菜单（现有逻辑不变）。

Expected: 上述均正常。文本消息渲染不受影响。

- [ ] **Step 6: Commit**

```bash
git add frontend/miniprogram/api/chat.js frontend/miniprogram/pages/chat/index.wxml frontend/miniprogram/pages/chat/index.wxss frontend/miniprogram/pages/chat/index.js
git commit -m "feat(miniprogram): 聊天气泡渲染并预览图片消息"
```

---

### Task 5: 前端 发送图片（"+"按钮 + 选图 + 上传发送）

**Files:**
- Modify: `frontend/miniprogram/api/chat.js:1,35`（require `upload`，新增并导出 `sendImageMessage`）
- Modify: `frontend/miniprogram/pages/chat/index.wxml:27-30`（输入栏加"+"按钮）
- Modify: `frontend/miniprogram/pages/chat/index.wxss`（加 `.plus-btn`）
- Modify: `frontend/miniprogram/pages/chat/index.js:1`（require `sendImageMessage`），新增 `onChooseImage`、`_sendImage`

**Interfaces:**
- Consumes: `upload` from `utils/request.js`；`POST /user/upload/image`（现成）；后端 Task 2 的 `type:'image'` 发送；Task 4 的渲染（确认发出后可见）。
- Produces: 用户可在聊天页点"+"→ 选相册/拍照 → 上传并发送图片消息。

- [ ] **Step 1: api/chat.js 新增 sendImageMessage**

修改 `frontend/miniprogram/api/chat.js`：

第 1 行改为 require `upload`：
```js
const { request, upload } = require('../utils/request')
```

在 `sendMessage` 函数后新增 `sendImageMessage`：
```js
async function sendImageMessage(toUserId, filePath) {
  const res = await upload({ url: '/user/upload/image', filePath: filePath, name: 'image' })
  return sendMessage(toUserId, res.url, 'image')
}
```

`module.exports` 末行加入 `sendImageMessage`：
```js
module.exports = { getContacts, getConversations, getMessages, sendMessage, sendImageMessage, markRead, deleteMessage, deleteConversation, clearAllMessages }
```

- [ ] **Step 2: 聊天页 require sendImageMessage**

修改 `frontend/miniprogram/pages/chat/index.js:1`：
```js
const { getMessages, sendMessage, sendImageMessage, markRead, deleteMessage } = require('../../api/chat')
```

- [ ] **Step 3: 输入栏加"+"按钮**

修改 `frontend/miniprogram/pages/chat/index.wxml:27-30` 的 `.input-bar`：
```xml
<view class="input-bar">
  <view class="plus-btn" bindtap="onChooseImage">＋</view>
  <input class="input-box" placeholder="输入消息…" value="{{inputText}}" bindinput="onInput" confirm-type="send" bindconfirm="onSend" adjust-position maxlength="500" />
  <view class="send-btn {{inputText ? 'send-active' : ''}}" bindtap="onSend">发送</view>
</view>
```

- [ ] **Step 4: 加 plus-btn 样式**

在 `frontend/miniprogram/pages/chat/index.wxss` 的 `.input-box` 之前加入：
```css
.plus-btn {
  width: 80rpx;
  height: 80rpx;
  line-height: 80rpx;
  text-align: center;
  font-size: 44rpx;
  color: #475569;
  background: #f4f6f8;
  border-radius: 50%;
  flex-shrink: 0;
}
```

- [ ] **Step 5: 加 onChooseImage 与 _sendImage 方法**

在 `frontend/miniprogram/pages/chat/index.js` 的 `onSend` 方法之后（`onPreviewImage` 之前或之后均可）加入：

```js
  onChooseImage() {
    wx.chooseMedia({
      count: 1,
      sourceType: ['album', 'camera'],
      mediaType: ['image'],
      success: (res) => {
        const filePath = res.tempFiles[0].tempFilePath
        this._sendImage(filePath)
      },
    })
  },

  async _sendImage(filePath) {
    wx.showLoading({ title: '发送中', mask: true })
    try {
      const msg = await sendImageMessage(this.data.peerId, filePath)
      const newMsg = this._decorate(msg)
      const msgs = this.data.messages.concat([newMsg])
      this.setData({ messages: msgs })
      this._scrollToBottom()
    } catch (e) {
      wx.showToast({ title: '发送失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },
```

- [ ] **Step 6: 验证端到端发送（开发者工具 + 真机）**

1. 启动后端 `cd backend && go run ./cmd/server`。
2. 开发者工具打开小程序、登录、进入与某 peer 的聊天页。
3. 点输入栏左侧"+"→ 选相册一张图（或拍照）。
4. 出现"发送中"loading，随后图片气泡出现在消息列表底部。
5. 用 curl 以 peer 身份或直接查库确认对方收到该图片消息（`type='image'`，`content` 为完整 URL）：
   ```bash
   curl -s "$BASE_URL/chat/messages?peer_id=<my_uid>&page=1" -H "Authorization: Bearer <peer_token>" | jq '.data[-1] | {type, content}'
   ```
6. 点该图片气泡 → 全屏预览；长按 → 删除菜单生效。
7. 文本发送仍正常（回归）。
8. 失败路径：断网/关后端时发图 → toast"发送失败"，不留假气泡。

Expected: 上述均正常。

- [ ] **Step 7: Commit**

```bash
git add frontend/miniprogram/api/chat.js frontend/miniprogram/pages/chat/index.js frontend/miniprogram/pages/chat/index.wxml frontend/miniprogram/pages/chat/index.wxss
git commit -m "feat(miniprogram): 聊天支持发送图片消息"
```

---

## Self-Review

**1. Spec 覆盖：**
- §3.1 数据模型 Type 字段+常量 → Task 1 ✓
- §3.2 SendMessage type 校验 → Task 2 ✓
- §3.3 GetConversations [图片] → Task 3 ✓
- §3.4 其余 handler 不动 → 计划未触及，符合 ✓
- §4.1 api/chat.js sendMessage type 参数 + sendImageMessage → Task 4 Step1 + Task 5 Step1 ✓
- §4.2 输入栏"+"按钮 + 气泡条件渲染 → Task 5 Step3 + Task 4 Step2 ✓
- §4.3 onChooseImage/_sendImage/onPreviewImage → Task 5 Step5 + Task 4 Step4 ✓
- §4.4 .plus-btn/.bubble-image 样式 → Task 5 Step4 + Task 4 Step3 ✓
- §5 错误处理（选图取消、上传失败 toast、type 非法 400）→ Task 2 Step6、Task 5 Step6 验证 ✓
- §6 测试（手动）→ 每个 Task 的 Verify 步骤 ✓

**2. 占位符扫描：** 无 TBD/TODO/"add appropriate"。所有代码步骤含完整可粘贴代码。Verify 步骤含具体 curl/操作。

**3. 类型/命名一致性：**
- `model.MsgTypeText/MsgTypeImage` — Task 1 定义，Task 2/3 使用，一致 ✓
- `sendMessage(toUserId, content, type)` — Task 4 Step1 定义，Task 5 sendImageMessage 调用 `sendMessage(toUserId, res.url, 'image')` ✓
- `sendImageMessage` — Task 5 Step1 定义并导出，Task 5 Step2 require，Step5 `_sendImage` 调用 ✓
- `onPreviewImage`/`onChooseImage`/`_sendImage` — 定义与 wxml bind 一致 ✓
- `res.tempFiles[0].tempFilePath` — 与 `wx.chooseMedia` 返回结构一致 ✓

无未定义引用。

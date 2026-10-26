# 聊天发送图片功能 设计文档

- 日期：2026-08-27
- 范围：微信小程序聊天（C2C 用户对用户）增加发送图片消息能力
- 涉及：后端 `backend`（Go/Gin）+ 前端 `frontend/miniprogram`

## 1. 背景与现状

当前聊天只支持纯文本消息：

- 前端聊天页 `frontend/miniprogram/pages/chat/`：输入栏只有文本 `input` + 发送按钮，无"+"面板；气泡只渲染 `{{item.content}}` 纯文本。
- 前端 API `frontend/miniprogram/api/chat.js:15`：`sendMessage(toUserId, content)` 发 `{to_user_id, content}`。
- 后端模型 `backend/internal/model/chat.go:5`：`ChatMessage` 无 `type` 字段，`content` 为 `varchar(500)` 纯文本。
- 后端 handler `backend/internal/handler/chat_handler.go:149`：`SendMessage` 只接收 `{to_user_id, content}`。
- 传输：无 WebSocket，纯 HTTP 每 3s 轮询（`pages/chat/index.js:95`）。

现成可复用基础设施：

- 前端 `utils/request.js:152` 的 `upload()` 封装 `wx.uploadFile`，带 JWT，解析 `{code:0, data}`。
- 后端通用上传接口 `POST /user/upload/image`（`handler/property.go:33` `UploadEditorImage`），任意登录用户可用，底层 `storage.Storage` 自动压缩（>200KB）、按年月分目录、返回完整 URL。
- `wx.previewImage` 已有用法：`pages/property-detail/index.js:183`。
- 数据库迁移用 GORM `AutoMigrate`（`cmd/server/main.go:45`，`ChatMessage` 在 :61）。

## 2. 关键决策

| 决策 | 选择 | 理由 |
|---|---|---|
| 消息类型区分方式 | 后端 `ChatMessage` 加 `type` 字段 | 干净、可扩展（未来语音/视频顺），用户已选定 |
| 图片消息 `content` 存什么 | 只存图片完整 URL 字符串 | 最简单（YAGNI）；前端 `<image mode="widthFix">` 宽度固定高度自适应，无需存尺寸 |
| 图片上传端点 | 复用现有 `POST /user/upload/image` | 零后端端点改动，功能完全适用 |
| 发送中 UX | 方案 A：`wx.showLoading('发送中')` 期间上传+发送，成功后 `concat` 真实消息 | 与现有文本 `onSend` 同构，poller 全量替换不会误伤，无竞态；YAGNI |

待定/未来增强（不在本次范围）：

- 方案 B（乐观本地"上传中"气泡 + poller 保留 `id<0` 本地条目）作为未来体验增强，v1 不做。

## 3. 后端设计

### 3.1 数据模型

`backend/internal/model/chat.go`：`ChatMessage` 增加 `Type` 字段：

```go
type ChatMessage struct {
    // ...既有字段...
    Content        string     `gorm:"type:varchar(500);not null" json:"content"`
    Type           string     `gorm:"type:varchar(20);not null;default:text" json:"type"`
    // ...
}
```

新增常量：

```go
const (
    MsgTypeText  = "text"
    MsgTypeImage = "image"
)
```

迁移：GORM `AutoMigrate` 自动加列；`NOT NULL DEFAULT 'text'` 使现有行回填为 `text`，不破坏现有数据与查询。

`content` 语义：`type=text` 存文本；`type=image` 存图片完整 URL（`UploadEditorImage` 返回的 `h.store.URL(url)` 本就是完整 URL，前端可直接用于 `<image src>` 和 `wx.previewImage`）。

### 3.2 SendMessage（`chat_handler.go:149`）

请求体增加 `Type`：

```go
var req struct {
    ToUserID uint64 `json:"to_user_id" binding:"required"`
    Content  string `json:"content" binding:"required,max=500"`
    Type     string `json:"type"`
}
```

逻辑：

- `req.Type` 为空时默认 `MsgTypeText`。
- 校验 `req.Type` 仅允许 `text`/`image`，否则 `BadRequest`。
- `msg := model.ChatMessage{FromUserID: me, ToUserID: req.ToUserID, Content: req.Content, Type: req.Type}`，`Create` 入库。

`content` 的 `max=500` 对图片 URL 足够（`/uploads/2026/08/xxx.jpg` 远短于 500）。

### 3.3 GetConversations（`chat_handler.go:41`）

会话列表 `last_message` 现在直接取 `content`，图片消息会显示一长串 URL。改造相关子查询：

- 子查询 select 增加 `m2.type`；
- `last_msg` 由 `m2.content` 改为 `CASE WHEN m2.type='image' THEN '[图片]' ELSE m2.content END`。

其余 SQL 结构不变。

### 3.4 其余 handler

`GetMessages`、`MarkRead`、`DeleteMessage`、`ClearAllMessages`、`DeleteConversation` 均按 id/from_user_id/to_user_id 操作，与 `type` 无关，**无需改动**。

## 4. 前端设计

### 4.1 API 层（`api/chat.js`）

- 改造 `sendMessage(toUserId, content, type='text')`：请求体带 `type`：
  ```js
  function sendMessage(toUserId, content, type) {
    return request({ url: '/chat/messages', method: 'POST',
      data: { to_user_id: toUserId, content: content, type: type || 'text' } })
  }
  ```
- 新增 `sendImageMessage(toUserId, filePath)`：
  ```js
  function sendImageMessage(toUserId, filePath) {
    return upload({ url: '/user/upload/image', filePath: filePath, name: 'image' })
      .then(function(res) { return sendMessage(toUserId, res.url, 'image') })
  }
  ```
  `upload()` 返回解析后的 `data`（即 `{url}`）。

### 4.2 聊天页 UI（`pages/chat/index.wxml`）

输入栏（:27）在 `input` 左侧加"+"按钮：

```xml
<view class="input-bar">
  <view class="plus-btn" bindtap="onChooseImage">＋</view>
  <input class="input-box" ... />
  <view class="send-btn ..." bindtap="onSend">发送</view>
</view>
```

气泡（:15-19）按 `type` 条件渲染：

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

`bindtap`（预览）与 `bindtouchstart/end`（长按删除）不冲突：500ms 阈值区分点按与长按。

### 4.3 聊天页逻辑（`pages/chat/index.js`）

新增方法：

- `onChooseImage()`：调 `wx.chooseMedia({ count:1, sourceType:['album','camera'], mediaType:['image'] })`，成功后 `this._sendImage(res.tempFiles[0].tempFilePath)`（注意 `chooseMedia` 返回 `tempFiles[].tempFilePath`，非旧 `chooseImage` 的 `tempFilePaths`）。
- `_sendImage(filePath)`：`wx.showLoading({title:'发送中', mask:true})` → `sendImageMessage(peerId, filePath)` → 成功后 `concat` 真实消息（`_decorate` 后追加，`_scrollToBottom`）→ `finally` `wx.hideLoading()`。失败：`wx.showToast('发送失败')`。
- `onPreviewImage(e)`：收集 `this.data.messages` 中所有 `type==='image'` 的 `content` 为 `urls`，`current` 取当前 `data-url`，调 `wx.previewImage({urls, current})`。

`_decorate`（:71）无需改动；`onSend`（:158）文本逻辑不变；poller（:109）按 id/length 比较的逻辑对图片消息同样适用（图片消息也有真实 id）。

### 4.4 样式（`pages/chat/index.wxss`）

- `.plus-btn`：与 `.input-box` 等高的方形按钮，居中"＋"。
- `.bubble-image`：`width:400rpx`（或同气泡最大宽度），`mode="widthFix"` 自动按比例定高。

## 5. 错误处理

- 选图取消：`wx.chooseMedia` 用户取消时 `success` 不回调，无需处理（`fail` 可吞掉）。
- 上传失败：`upload()` reject → `_sendImage` catch → `wx.showToast('发送失败')`，无假气泡残留。
- 发送 API 失败：同上 toast，不追加消息。
- 后端 `type` 非法：返 400，前端 toast 参数错误。
- 图片加载失败（远端 URL 失效）：`<image>` 的 `binderror` 可选置占位图（v1 可不做，YAGNI）。

## 6. 测试

> 现状：后端全仓 0 个 `_test.go`，无既有测试框架与测试 DB 装配。本次不引入测试框架（YAGNI、外科式改动），改用手动验证。若需引入后端单测，应作为独立任务先搭建测试基建（sqlite in-memory + AutoMigrate + gin test context 装配），不在本功能范围。

### 6.1 后端（手动：curl / 开发者工具网络面板）

- 发送 image 消息：POST `/chat/messages` body `{to_user_id, content:url, type:'image'}` → 200，查 DB `type='image'`、`content=url`。
- 不传 type：默认 `text`，与现有文本消息行为一致（向后兼容）。
- `type` 非法（如 `'video'`）：返 400。
- `GetConversations`：会话最后一条为图片消息时，`last_message` 为 `[图片]` 而非 URL。

### 6.2 前端（手动，开发者工具 + 真机）

- 相册选图发送 → 气泡出图、对方收到图片。
- 拍照发送 → 同上。
- 点击图片 → 全屏预览、可滑动浏览会话内多张图片。
- 长按图片气泡 → 弹删除菜单 → 删除成功。
- 发送中 loading 显示，失败 toast。
- 与现有文本消息混排显示正常。

## 7. 不做（YAGNI）

- 语音/视频/文件消息（仅图片）。
- 多图一次性发送（一次一张，WeChat 标准）。
- 图片尺寸/缩略图存储（`widthFix` 够用）。
- 消息本地缓存（保持现状无缓存）。
- 乐观本地"上传中"气泡（方案 B，未来增强）。
- 独立 `/chat/upload/image` 端点（复用通用端点）。

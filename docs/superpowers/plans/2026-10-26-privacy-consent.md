# 登录页隐私协议合规改造 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复审核拒绝原因 1「隐私政策默认自动同意」——新增《用户服务协议》《隐私政策》静态页，登录页改为用户主动勾选同意（默认不勾选、未勾选拦截登录），并启用微信官方隐私接口检查。

**Architecture:** 两个纯静态协议页（`pages/agreement/user`、`pages/agreement/privacy`，rich-text 渲染内置 HTML 文本，内联样式）；登录页在登录按钮上方加 checkbox 行，`onLogin` 入口校验勾选状态；`app.json` 注册新页面并加 `"__usePrivacyCheck__": true`。不记住勾选状态，每次进登录页默认不勾选。

**Tech Stack:** 微信小程序原生（WXML/WXSS/JS），无构建步骤。

## Global Constraints

- 前端目录 `frontend/miniprogram`，无单测框架 → **手动验证（微信开发者工具）**，不引入测试框架（沿用 2026-08-27 计划惯例）。
- 品牌色用 CSS 变量 `var(--color-primary)`（`app.wxss` 已定义，登录页已在用）。
- 勾选框**默认不勾选**；**不写 storage 记忆**（spec 决策，用户确认从严）。
- rich-text 的 `nodes` 用 HTML 字符串 + **内联样式**（rich-text 内部节点不吃页面 wxss 的 class）。
- 协议文本为通用模板（房产信息平台场景），不编造具体公司名/邮箱/电话，联系方式统一写「微信小程序平台提供的客服渠道」。
- 提交信息风格：`feat(miniprogram): ...`，结尾 `Co-Authored-By: Claude Code <noreply@anthropic.com>`。
- 工作树里有**别人改过的** `frontend/miniprogram/package.json`、`package-lock.json`（未提交改动），**不要 add、不要提交它们**。

---

### Task 1: 新增《用户服务协议》静态页

**Files:**
- Create: `frontend/miniprogram/pages/agreement/user/index.json`
- Create: `frontend/miniprogram/pages/agreement/user/index.wxml`
- Create: `frontend/miniprogram/pages/agreement/user/index.js`
- Create: `frontend/miniprogram/pages/agreement/user/index.wxss`
- Modify: `frontend/miniprogram/app.json:23`（pages 数组）

**Interfaces:**
- Consumes: 无
- Produces: 路由 `/pages/agreement/user/index`（Task 3 登录页链接跳转目标）

- [ ] **Step 1: 创建 index.json**

```json
{
  "navigationBarTitleText": "用户服务协议",
  "usingComponents": {}
}
```

- [ ] **Step 2: 创建 index.wxml**

```xml
<view class="page">
  <rich-text class="content" nodes="{{nodes}}" />
</view>
```

- [ ] **Step 3: 创建 index.js（完整协议文本）**

```js
// 《用户服务协议》静态页：内容为通用模板，正式法务文本可后续在此替换
Page({
  data: {
    nodes: [
      '<h2 style="font-size:32rpx;font-weight:600;color:#1a1a1a;margin:40rpx 0 16rpx;">一、协议的接受</h2>',
      '<p style="font-size:28rpx;color:#333;line-height:1.7;margin:0 0 24rpx;">欢迎使用本小程序。请您在使用前仔细阅读并充分理解本协议的全部内容。您勾选同意本协议并通过微信授权登录，即表示您已阅读并同意接受本协议的全部条款。若您不同意本协议，请停止使用本小程序。</p>',
      '<h2 style="font-size:32rpx;font-weight:600;color:#1a1a1a;margin:40rpx 0 16rpx;">二、账号与登录</h2>',
      '<p style="font-size:28rpx;color:#333;line-height:1.7;margin:0 0 24rpx;">本小程序通过微信授权方式登录。登录时您可选择授权使用微信头像及昵称，用于生成您在本平台的用户资料。您应妥善保管自己的微信账号，因账号保管不善导致的责任由您自行承担。</p>',
      '<h2 style="font-size:32rpx;font-weight:600;color:#1a1a1a;margin:40rpx 0 16rpx;">三、服务内容</h2>',
      '<p style="font-size:28rpx;color:#333;line-height:1.7;margin:0 0 24rpx;">本小程序为房产信息服务平台，提供房源信息浏览、检索、地图找房、房源发布、预约看房、房贷计算及用户间即时沟通等功能。</p>',
      '<h2 style="font-size:32rpx;font-weight:600;color:#1a1a1a;margin:40rpx 0 16rpx;">四、用户行为规范</h2>',
      '<p style="font-size:28rpx;color:#333;line-height:1.7;margin:0 0 24rpx;">您在使用本小程序时应遵守法律法规及平台规则，发布真实、合法、有效的房源及图文信息，不得发布虚假房源、违法信息或侵犯他人权益的内容。您对自己发布的内容（包括文字、图片及聊天消息）承担全部责任。平台有权对违规内容进行删除、屏蔽等处理。</p>',
      '<h2 style="font-size:32rpx;font-weight:600;color:#1a1a1a;margin:40rpx 0 16rpx;">五、信息展示与免责</h2>',
      '<p style="font-size:28rpx;color:#333;line-height:1.7;margin:0 0 24rpx;">本小程序展示的房源等信息由平台用户（含经纪机构及个人）自行发布，平台仅提供信息展示与沟通渠道，不参与具体交易，不对信息的真实性、准确性作出担保。您应自行核实相关信息并谨慎决策。</p>',
      '<h2 style="font-size:32rpx;font-weight:600;color:#1a1a1a;margin:40rpx 0 16rpx;">六、协议的变更与终止</h2>',
      '<p style="font-size:28rpx;color:#333;line-height:1.7;margin:0 0 24rpx;">我们可能适时修订本协议并在小程序内公示，修订后的协议自公示时生效。若您继续使用即视为接受修订内容。您可随时停止使用并注销账号以终止本协议。</p>',
      '<h2 style="font-size:32rpx;font-weight:600;color:#1a1a1a;margin:40rpx 0 16rpx;">七、联系方式</h2>',
      '<p style="font-size:28rpx;color:#333;line-height:1.7;margin:0 0 24rpx;">如对本协议有任何疑问，请通过微信小程序平台提供的客服渠道与我们联系。</p>',
    ].join(''),
  },
})
```

- [ ] **Step 4: 创建 index.wxss**

```css
.page {
  min-height: 100vh;
  background: #fff;
  padding: 24rpx 40rpx 60rpx;
  box-sizing: border-box;
}
```

- [ ] **Step 5: app.json 注册页面**

`frontend/miniprogram/app.json` 的 `pages` 数组，在 `"pages/login/index"` 之后插入：

```json
    "pages/login/index",
    "pages/agreement/user/index",
```

- [ ] **Step 6: 验证**

Run: `node -e "JSON.parse(require('fs').readFileSync('frontend/miniprogram/app.json','utf8')); console.log('app.json OK')" && node --check frontend/miniprogram/pages/agreement/user/index.js`
Expected: 两个 OK 无报错

微信开发者工具打开项目 → 编译无报错 → 手动在模拟器地址栏/控制台 `wx.navigateTo({url:'/pages/agreement/user/index'})` → 页面打开、标题「用户服务协议」、正文各章节完整可读。

- [ ] **Step 7: Commit**

```bash
git add frontend/miniprogram/pages/agreement/user/ frontend/miniprogram/app.json
git commit -m "feat(miniprogram): 新增用户服务协议静态页

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: 新增《隐私政策》静态页

**Files:**
- Create: `frontend/miniprogram/pages/agreement/privacy/index.json`
- Create: `frontend/miniprogram/pages/agreement/privacy/index.wxml`
- Create: `frontend/miniprogram/pages/agreement/privacy/index.js`
- Create: `frontend/miniprogram/pages/agreement/privacy/index.wxss`
- Modify: `frontend/miniprogram/app.json:24`（pages 数组）

**Interfaces:**
- Consumes: 无
- Produces: 路由 `/pages/agreement/privacy/index`（Task 3 登录页链接跳转目标）

- [ ] **Step 1: 创建 index.json**

```json
{
  "navigationBarTitleText": "隐私政策",
  "usingComponents": {}
}
```

- [ ] **Step 2: 创建 index.wxml**

```xml
<view class="page">
  <rich-text class="content" nodes="{{nodes}}" />
</view>
```

- [ ] **Step 3: 创建 index.js（完整政策文本）**

```js
// 《隐私政策》静态页：内容为通用模板，正式法务文本可后续在此替换
Page({
  data: {
    nodes: [
      '<h2 style="font-size:32rpx;font-weight:600;color:#1a1a1a;margin:40rpx 0 16rpx;">一、引言</h2>',
      '<p style="font-size:28rpx;color:#333;line-height:1.7;margin:0 0 24rpx;">我们非常重视您的个人信息和隐私保护。本政策说明我们收集哪些信息、如何使用和保护这些信息，以及您享有的权利。使用本小程序前请仔细阅读，您勾选同意即表示接受本政策内容。</p>',
      '<h2 style="font-size:32rpx;font-weight:600;color:#1a1a1a;margin:40rpx 0 16rpx;">二、我们收集的信息</h2>',
      '<p style="font-size:28rpx;color:#333;line-height:1.7;margin:0 0 24rpx;">在您使用本小程序过程中，我们收集以下信息：</p>',
      '<p style="font-size:28rpx;color:#333;line-height:1.7;margin:0 0 24rpx;">1. 账号信息：您授权使用的微信头像、昵称，用于登录及展示用户资料；</p>',
      '<p style="font-size:28rpx;color:#333;line-height:1.7;margin:0 0 24rpx;">2. 位置信息：在使用地图找房、发布房源自动定位等功能时，经您授权获取的位置信息，仅用于房源定位与展示；</p>',
      '<p style="font-size:28rpx;color:#333;line-height:1.7;margin:0 0 24rpx;">3. 内容信息：您发布的房源文字与图片、您与他人聊天中的文字与图片消息，用于提供信息发布与沟通功能；</p>',
      '<p style="font-size:28rpx;color:#333;line-height:1.7;margin:0 0 24rpx;">4. 设备信息：微信平台为保障服务安全与稳定而提供的基础设备与日志信息。</p>',
      '<h2 style="font-size:32rpx;font-weight:600;color:#1a1a1a;margin:40rpx 0 16rpx;">三、信息的使用</h2>',
      '<p style="font-size:28rpx;color:#333;line-height:1.7;margin:0 0 24rpx;">我们仅在为您提供账号登录、资料展示、房源发布与浏览、地图找房、预约看房、用户间沟通等功能的必要范围内使用上述信息，不会将信息用于本政策未载明的用途。</p>',
      '<h2 style="font-size:32rpx;font-weight:600;color:#1a1a1a;margin:40rpx 0 16rpx;">四、信息的存储与保护</h2>',
      '<p style="font-size:28rpx;color:#333;line-height:1.7;margin:0 0 24rpx;">您的信息存储于中华人民共和国境内的服务器，传输过程采用加密措施。我们采取合理的安全技术与管理措施保护您的信息，仅在实现功能所必需的期限内保存。</p>',
      '<h2 style="font-size:32rpx;font-weight:600;color:#1a1a1a;margin:40rpx 0 16rpx;">五、信息的共享</h2>',
      '<p style="font-size:28rpx;color:#333;line-height:1.7;margin:0 0 24rpx;">除以下情形外，我们不会向任何第三方提供您的个人信息：经您授权同意；为向您提供服务所必需（如图片存储服务）；法律法规规定的情形。</p>',
      '<h2 style="font-size:32rpx;font-weight:600;color:#1a1a1a;margin:40rpx 0 16rpx;">六、您的权利</h2>',
      '<p style="font-size:28rpx;color:#333;line-height:1.7;margin:0 0 24rpx;">您有权查阅、更正您的头像与昵称等资料；有权删除您发布的内容；有权退出登录以停止信息收集；您也可以通过注销账号删除您的账号信息。您可随时在微信设置中管理对本小程序的授权。</p>',
      '<h2 style="font-size:32rpx;font-weight:600;color:#1a1a1a;margin:40rpx 0 16rpx;">七、未成年人保护</h2>',
      '<p style="font-size:28rpx;color:#333;line-height:1.7;margin:0 0 24rpx;">本小程序面向成年人使用。如您是未成年人，请在监护人指导下使用，并确保已获得监护人同意。</p>',
      '<h2 style="font-size:32rpx;font-weight:600;color:#1a1a1a;margin:40rpx 0 16rpx;">八、政策的更新与联系方式</h2>',
      '<p style="font-size:28rpx;color:#333;line-height:1.7;margin:0 0 24rpx;">我们可能适时更新本政策并在小程序内公示。如对本政策有任何疑问，请通过微信小程序平台提供的客服渠道与我们联系。</p>',
    ].join(''),
  },
})
```

- [ ] **Step 4: 创建 index.wxss**

```css
.page {
  min-height: 100vh;
  background: #fff;
  padding: 24rpx 40rpx 60rpx;
  box-sizing: border-box;
}
```

- [ ] **Step 5: app.json 注册页面**

`frontend/miniprogram/app.json` 的 `pages` 数组，在 `"pages/agreement/user/index"` 之后插入：

```json
    "pages/agreement/user/index",
    "pages/agreement/privacy/index",
```

- [ ] **Step 6: 验证**

Run: `node -e "JSON.parse(require('fs').readFileSync('frontend/miniprogram/app.json','utf8')); console.log('app.json OK')" && node --check frontend/miniprogram/pages/agreement/privacy/index.js`
Expected: 两个 OK 无报错

微信开发者工具编译无报错 → 控制台 `wx.navigateTo({url:'/pages/agreement/privacy/index'})` → 页面打开、标题「隐私政策」、八个章节完整可读。

- [ ] **Step 7: Commit**

```bash
git add frontend/miniprogram/pages/agreement/privacy/ frontend/miniprogram/app.json
git commit -m "feat(miniprogram): 新增隐私政策静态页

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: 登录页勾选同意 + 官方隐私检查

**Files:**
- Modify: `frontend/miniprogram/pages/login/index.wxml:23-26`
- Modify: `frontend/miniprogram/pages/login/index.js:9-53`
- Modify: `frontend/miniprogram/pages/login/index.wxss:70-87`
- Modify: `frontend/miniprogram/app.json`（加 `__usePrivacyCheck__`）

**Interfaces:**
- Consumes: 路由 `/pages/agreement/user/index`（Task 1）、路由 `/pages/agreement/privacy/index`（Task 2）
- Produces: 无（终端页面）

- [ ] **Step 1: 修改 index.wxml**

将登录按钮及提示部分（原 23-26 行）：

```xml
  <button class="login-btn" bindtap="onLogin" loading="{{loading}}">
    微信一键登录
  </button>
  <view class="login-tip">登录即表示同意《用户协议》和《隐私政策》</view>
```

替换为：

```xml
  <view class="agreement-row">
    <checkbox-group bindchange="onToggleAgreed">
      <checkbox value="agreed" checked="{{agreed}}" color="#0F766E" />
    </checkbox-group>
    <view class="agreement-text">
      我已阅读并同意<text class="agreement-link" catchtap="onOpenUserAgreement">《用户服务协议》</text>和<text class="agreement-link" catchtap="onOpenPrivacy">《隐私政策》</text>
    </view>
  </view>

  <button class="login-btn" bindtap="onLogin" loading="{{loading}}">
    微信一键登录
  </button>
```

要点：勾选框默认 `agreed:false` 不勾选；协议名用 `catchtap` 避免事件冒泡误触勾选；删除原「登录即表示同意」文案行。

- [ ] **Step 2: 修改 index.js**

`data` 增加 `agreed: false`：

```js
  data: {
    loading: false,
    avatarUrl: DEFAULT_AVATAR,
    nickname: '',
    agreed: false,
  },
```

在 `onNicknameInput` 之后新增三个方法：

```js
  // 勾选/取消勾选协议（默认不勾选，不记忆历史选择）
  onToggleAgreed(e) {
    this.setData({ agreed: e.detail.value.length > 0 })
  },

  onOpenUserAgreement() {
    wx.navigateTo({ url: '/pages/agreement/user/index' })
  },

  onOpenPrivacy() {
    wx.navigateTo({ url: '/pages/agreement/privacy/index' })
  },
```

`onLogin` 开头（`this.setData({ loading: true })` 之前）加入拦截：

```js
  async onLogin() {
    if (!this.data.agreed) {
      wx.showToast({ title: '请先阅读并同意用户服务协议和隐私政策', icon: 'none' })
      return
    }
    this.setData({ loading: true })
    // ...以下原有登录逻辑不动...
```

其余登录、头像上传、跳转逻辑全部不动。

- [ ] **Step 3: 修改 index.wxss**

删除孤儿样式 `.login-tip`（原 82-87 行，随文案删除而不再使用），并在 `.login-btn` 之前新增：

```css
/* 协议勾选行 */
.agreement-row {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24rpx;
}

.agreement-row checkbox-group {
  display: inline-flex;
  align-items: center;
}

.agreement-text {
  font-size: 24rpx;
  color: #999;
}

.agreement-link {
  color: var(--color-primary);
}
```

- [ ] **Step 4: app.json 启用官方隐私检查**

在 `app.json` 根级（如 `"style": "v2",` 旁）加入：

```json
  "__usePrivacyCheck__": true,
```

- [ ] **Step 5: 验证**

Run: `node -e "JSON.parse(require('fs').readFileSync('frontend/miniprogram/app.json','utf8')); console.log('app.json OK')" && node --check frontend/miniprogram/pages/login/index.js`
Expected: 两个 OK 无报错

微信开发者工具手动验证（对应 spec 验证方式）：

1. 进登录页 → 勾选框为**未勾选**状态；点「微信一键登录」→ toast「请先阅读并同意用户服务协议和隐私政策」，Network 面板无 `/auth/login` 请求
2. 点《用户服务协议》/《隐私政策》→ 跳转对应协议页；返回后勾选状态不变
3. 勾选后登录 → 与改造前流程一致（头像昵称正常、停车白名单/redirect 跳转正常）
4. 登录后退出、重新进登录页 → 勾选框恢复未勾选
5. （隐私弹窗为微信官方行为，基础库 2.32.3+ 生效；开发者工具可勾选「模拟隐私接口」验证 chooseMedia/getLocation 触发官方弹窗）

- [ ] **Step 6: Commit**

```bash
git add frontend/miniprogram/pages/login/ frontend/miniprogram/app.json
git commit -m "feat(miniprogram): 登录页改为用户主动勾选同意协议

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## 提审前 MP 后台待办（非代码，人工操作）

1. 补充类目「社交-陌生人交友」或「社交-熟人交友」（拒绝原因 2）
2. 补充类目「社交-笔记」（拒绝原因 3）
3. 更新「用户隐私保护指引」，声明 chooseMedia / getLocation / chooseAvatar / getUserInfo 等隐私接口（配合 `__usePrivacyCheck__`），提审时按「采集用户隐私」申报

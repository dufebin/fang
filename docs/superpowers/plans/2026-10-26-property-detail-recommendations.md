# 房源详情页“看了又看”推荐 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 房源详情页滑到底部显示“看了又看”推荐列表，点击卡片进入推荐房源详情，继续上滑分页加载更多。

**Architecture:** 后端新增 `GET /h5/property/:id/recommendations` 接口（排除自身与下架房源，按相关度排序：同区同型 > 同区 > 同型 > 其它，同级 `created_at DESC`，标准分页）；小程序详情页详情加载成功后预加载推荐第一页，复用 `property-card` 组件渲染，`onReachBottom` 加载下一页。

**Tech Stack:** Go 1.26 / Gin / GORM v1.31（MySQL，远程 dev 库）· 微信小程序原生（无构建、无测试基建）

**Spec:** `docs/superpowers/specs/2026-10-26-property-detail-recommendations-design.md`

## Global Constraints

- 排序中 district 是用户输入：必须用 `clause.Expr` 参数化，禁止字符串拼接进 SQL
- 远程 dev 数据库（111.229.9.22:3306）：验证只读（curl 查询），严禁写库
- 本机 9080 端口已有运行中的 dev server（pid 1521675）：不要杀它、不要占它，验证用 9081 起第二个实例
- 项目无测试基建（后端无 `_test.go`，小程序无测试脚本）：后端用 build + curl 验证，小程序用 `node --check` 语法检查 + 用户微信开发者工具验收，不引入测试框架
- 代码风格与现有文件一致：Go 中文注释；小程序沿用现有分页模式（`pages/property-list/index.js`）
- 遵循 CLAUDE.md：surgical changes，只改任务列出的行，不顺手重构
- 提交信息用中文 conventional commits，结尾加 `Co-Authored-By: Claude Code <noreply@anthropic.com>`

---

### Task 1: 后端推荐接口（repo + service + handler + 路由）

**Files:**
- Modify: `backend/internal/repository/property_repo.go`（文件末尾追加方法；import 块加 `gorm.io/gorm/clause`）
- Modify: `backend/internal/service/property_service.go`（`HotDistricts` 方法后追加方法，约 :255 处）
- Modify: `backend/internal/handler/property.go`（`List` 方法后追加 handler，约 :168 处）
- Modify: `backend/cmd/server/main.go:210`（h5 组加一行路由）

**Interfaces:**
- Consumes: 现有 `(*PropertyRepo).FindByID(id uint64) (*model.Property, error)`（未找到返回 `(nil, nil)`，`property_repo.go:50`）；现有 `response.SuccessPage / BadRequest / ServerError`
- Produces:
  - Go: `(*PropertyRepo).ListRecommendations(excludeID uint64, district, propertyType string, page, limit int) ([]model.Property, int64, error)`
  - Go: `(*PropertyService).GetRecommendations(id uint64, page, limit int) ([]model.Property, int64, error)`
  - Go: `(*PropertyHandler).Recommendations(c *gin.Context)`
  - HTTP: `GET /api/h5/property/:id/recommendations?page=1&page_size=10` → `{code:0, data:{list: Property[], total, page, limit}}`（与 `/h5/properties` 同形状，Task 2 依赖此形状）

- [ ] **Step 1: repo 增加 `ListRecommendations`**

`backend/internal/repository/property_repo.go` import 块改为：

```go
import (
	"fangchan/internal/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)
```

文件末尾追加（`ListByIDs` 等现有方法之后）：

```go
// ListRecommendations 详情页“看了又看”推荐：排除自身与下架房源，
// 相关度排序（同区同型 > 同区 > 同型 > 其它），同级按最新优先。
// district 为用户输入，排序必须参数化，禁止拼进 SQL 字符串。
func (r *PropertyRepo) ListRecommendations(excludeID uint64, district, propertyType string, page, limit int) ([]model.Property, int64, error) {
	var properties []model.Property
	var total int64

	query := r.db.Model(&model.Property{}).
		Where("id != ? AND status != ?", excludeID, model.PropertyStatusOffline)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if err := query.
		Preload("Images", func(db *gorm.DB) *gorm.DB {
			return db.Order("sort_order ASC")
		}).
		Clauses(clause.OrderBy{
			Expression: clause.Expr{
				SQL:  "(district = ? AND property_type = ?) DESC, (district = ?) DESC, (property_type = ?) DESC, created_at DESC",
				Vars: []interface{}{district, propertyType, district, propertyType},
			},
		}).
		Offset((page - 1) * limit).
		Limit(limit).
		Find(&properties).Error; err != nil {
		return nil, 0, err
	}

	return properties, total, nil
}
```

- [ ] **Step 2: service 增加 `GetRecommendations`**

`backend/internal/service/property_service.go` 在 `HotDistricts`（:253-255）之后追加：

```go
// GetRecommendations 详情页“看了又看”推荐；房源不存在时返回空列表（此时详情页本身已是失败态）
func (s *PropertyService) GetRecommendations(id uint64, page, limit int) ([]model.Property, int64, error) {
	p, err := s.propertyRepo.FindByID(id)
	if err != nil {
		return nil, 0, err
	}
	if p == nil {
		return []model.Property{}, 0, nil
	}
	return s.propertyRepo.ListRecommendations(id, p.District, p.PropertyType, page, limit)
}
```

- [ ] **Step 3: handler 增加 `Recommendations`**

`backend/internal/handler/property.go` 在 `List` 方法结尾（:168 `response.SuccessPage(c, list, total, page, limit)` 与 `}` 之后）追加：

```go
// Recommendations 详情页“看了又看”推荐列表
func (h *PropertyHandler) Recommendations(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的房源ID")
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	// 兼容小程序发来的 page_size
	if ps := c.Query("page_size"); ps != "" {
		if v, err := strconv.Atoi(ps); err == nil && v > 0 {
			limit = v
		}
	}
	if page < 1 {
		page = 1
	}
	if limit > 50 {
		limit = 50
	}

	list, total, err := h.propertySvc.GetRecommendations(id, page, limit)
	if err != nil {
		response.ServerError(c, err)
		return
	}

	response.SuccessPage(c, list, total, page, limit)
}
```

- [ ] **Step 4: 注册路由**

`backend/cmd/server/main.go:210` `h5.GET("/property/:id/wxacode", propertyH.GetWxaCode)` 之后加一行：

```go
		h5.GET("/property/:id/recommendations", propertyH.Recommendations)
```

- [ ] **Step 5: 编译验证**

```bash
cd /data/source/fang/backend && go build ./... && go vet ./...
```

Expected: 无任何输出（退出码 0）。若有编译错误，修复后重跑；若 vet 报出与本任务改动文件无关的既有问题，记录并继续（不修无关代码）。

- [ ] **Step 6: 启动 9081 验证实例**

```bash
sed 's/port: 9080/port: 9081/' /data/source/fang/backend/configs/config.yaml > /tmp/fang-config-9081.yaml
cd /data/source/fang/backend && CONFIG_PATH=/tmp/fang-config-9081.yaml nohup go run ./cmd/server > /tmp/fang-9081.log 2>&1 &
for i in $(seq 1 30); do curl -s -o /dev/null 'http://127.0.0.1:9081/api/h5/properties?page=1&page_size=1' && break; sleep 1; done
grep -c "error\|panic" /tmp/fang-9081.log; curl -s 'http://127.0.0.1:9081/api/h5/properties?page=1&page_size=1' | head -c 200
```

Expected: 等待循环最多 30s（首次 `go run` 需编译）；log 无 error/panic（grep 计数为 0）；curl 返回 `{"code":0,...}`。若起不来，看 `/tmp/fang-9081.log` 排查（9080 实例已在跑证明依赖可用，通常是端口/配置问题）。

- [ ] **Step 7: curl 验证接口行为**

先取锚点房源（选一个 district 非空的）：

```bash
curl -s 'http://127.0.0.1:9081/api/h5/properties?page=1&page_size=20' | jq '[.data.list[] | {id, district, property_type, status}]'
```

记下任一在售房源的 `id`（下称 `$ID`）与其 `district`、`property_type`。然后逐项验证：

```bash
# a) 基本形状 + 排除自身 + 不含下架
curl -s "http://127.0.0.1:9081/api/h5/property/$ID/recommendations?page=1&page_size=10" \
  | jq '{total, n: (.data.list|length), has_self: ([.data.list[].id] | index($ID|tonumber) != null), has_offline: ([.data.list[].status] | index("offline") != null), ids: [.data.list[].id]}'
```

Expected: `has_self=false`，`has_offline=false`，`n<=10`；若库里在线房源 >1 套则 `n>0`。

```bash
# b) total 等于在线房源总数 - 1（排除自身）
curl -s 'http://127.0.0.1:9081/api/h5/properties?page=1&page_size=1' | jq '.data.total'
```

Expected: 该值减 1 等于 a) 的 `total`。

```bash
# c) 相关度排序：同区房源应排在异区房源之前（若存在同区房源）
curl -s "http://127.0.0.1:9081/api/h5/property/$ID/recommendations?page=1&page_size=50" \
  | jq --arg d "$DISTRICT" '[.data.list[] | {id, district, same_district: (.district == $d), created_at}]'
```

Expected: `same_district=true` 的条目全部排在 `false` 条目之前（`$DISTRICT` 换成锚点的 district）。若库里没有同区房源，退化为验证 `created_at` 降序。

```bash
# d) 分页：两页数据不重复
curl -s "http://127.0.0.1:9081/api/h5/property/$ID/recommendations?page=1&page_size=5" | jq '[.data.list[].id]' > /tmp/rec-p1.json
curl -s "http://127.0.0.1:9081/api/h5/property/$ID/recommendations?page=2&page_size=5" | jq '[.data.list[].id]' > /tmp/rec-p2.json
jq -s '.[0] as $a | .[1] as $b | {overlap: ($a - ($a - $b) | length), p2n: ($b|length)}' /tmp/rec-p1.json /tmp/rec-p2.json
```

Expected: `overlap=0`；若总推荐数 >5 则 `p2n=5`。

```bash
# e) 不存在的房源 id → 空列表不报错
curl -s 'http://127.0.0.1:9081/api/h5/property/99999999/recommendations' | jq '{code, total, n: (.data.list|length)}'
```

Expected: `code=0, total=0, n=0`。

```bash
# f) 无效 id → 400
curl -s 'http://127.0.0.1:9081/api/h5/property/abc/recommendations' | jq '.code'
```

Expected: 非 0（BadRequest）。

- [ ] **Step 8: 停掉验证实例并清理**

```bash
PID=$(ss -tlnp | grep ':9081' | grep -oP 'pid=\K[0-9]+' | head -1); [ -n "$PID" ] && kill "$PID"
pkill -f "fang-config-9081" 2>/dev/null; rm -f /tmp/fang-config-9081.yaml /tmp/fang-9081.log /tmp/rec-p1.json /tmp/rec-p2.json
ss -tlnp | grep 9081; ss -tlnp | grep 9080
```

Expected: 第一条 ss 无输出（9081 已停）；第二条仍有 9080 的原实例（pid 1521675，不受影响）。

- [ ] **Step 9: Commit**

```bash
cd /data/source/fang && git add backend/internal/repository/property_repo.go backend/internal/service/property_service.go backend/internal/handler/property.go backend/cmd/server/main.go
git commit -m "feat(property): 房源详情页“看了又看”推荐接口，同区同型相关度排序分页

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: 小程序详情页接入推荐

**Files:**
- Modify: `frontend/miniprogram/api/property.js`（加函数 + 导出）
- Modify: `frontend/miniprogram/pages/property-detail/index.json`（注册组件）
- Modify: `frontend/miniprogram/pages/property-detail/index.js`（常量/导入/data/onLoad/加载钩子/两个新方法）
- Modify: `frontend/miniprogram/pages/property-detail/index.wxml:215`（认领区块后插入推荐区块）
- Modify: `frontend/miniprogram/pages/property-detail/index.wxss`（末尾追加 `.no-more`）

**Interfaces:**
- Consumes: Task 1 的 `GET /api/h5/property/:id/recommendations?page=&page_size=`，`utils/request.js` 已解包 `{code:0,data}`，`res.list/res.total` 直接可用（与 `listProperties` 同模式）；`property-card` 组件（`property` 属性传 `model.Property` 形状对象，`agent-code` 透传到跳转 `a` 参数，自带封面计算/点击跳转/卡片间距 `margin-bottom:24rpx`）
- Produces: 详情页 `data.recommendList/recommendLoading/recommendNoMore`；方法 `onReachBottom` / `_loadRecommendations`（页面私有，无外部依赖方）

- [ ] **Step 1: API 层加函数**

`frontend/miniprogram/api/property.js` 在 `getNearbyProperties` 之后（:17 后）加：

```js
// 房源详情页“看了又看”推荐
function getPropertyRecommendations(id, params) {
  return request({ url: `/h5/property/${id}/recommendations`, data: params })
}
```

`module.exports` 的 `getNearbyProperties,` 之后加一行 `getPropertyRecommendations,`。

- [ ] **Step 2: 注册 property-card 组件**

`frontend/miniprogram/pages/property-detail/index.json` 改为：

```json
{
  "navigationBarTitleText": "房源详情",
  "usingComponents": {
    "agent-card": "/components/agent-card/index",
    "property-card": "/components/property-card/index"
  }
}
```

- [ ] **Step 3: index.js 加常量与导入**

文件顶部 require 区（:1）改为：

```js
const { getPropertyDetail, claimProperty, unclaimProperty, getPropertyRecommendations } = require('../../api/property')
```

require 区之后、`Page({` 之前加：

```js
const REC_PAGE_SIZE = 10
```

- [ ] **Step 4: index.js 加 data 字段与页码初始化**

`data` 中 `highlightCards: [],`（:38）之后加三行：

```js
    recommendList: [],
    recommendLoading: false,
    recommendNoMore: false,
```

`onLoad` 中 `this._propertyId = id`（:44）之后加：

```js
    this._recPage = 1
```

- [ ] **Step 5: index.js 详情加载成功后预加载推荐**

`_loadDetail` 中 `wx.setNavigationBarTitle({ title: property.title || '房源详情' })`（:173）之后加：

```js
      // 预加载“看了又看”推荐第一页，失败静默不影响详情
      this._loadRecommendations()
```

- [ ] **Step 6: index.js 加 onReachBottom 与 _loadRecommendations**

`onReload()` 方法（:49-51）之后加两个方法：

```js
  onReachBottom() {
    this._loadRecommendations()
  },

  async _loadRecommendations() {
    if (this.data.recommendLoading || this.data.recommendNoMore) return
    this.setData({ recommendLoading: true })
    try {
      const res = await getPropertyRecommendations(this._propertyId, {
        page: this._recPage,
        page_size: REC_PAGE_SIZE,
      })
      const list = res.list || []
      this._recPage++
      this.setData({
        recommendList: [...this.data.recommendList, ...list],
        recommendLoading: false,
        recommendNoMore: list.length < REC_PAGE_SIZE,
      })
    } catch (_) {
      // 静默失败；页码未增，滑到底 onReachBottom 自动重试
      this.setData({ recommendLoading: false })
    }
  },
```

- [ ] **Step 7: index.wxml 插入推荐区块**

认领区块结束（:215 的 `</view>`）之后、`<!-- Bottom Padding for Sticky Bar -->`（:217）之前插入：

```xml
  <!-- 看了又看：房源推荐 -->
  <view wx:if="{{recommendList.length}}" class="section recommend-section">
    <view class="section-title-accent">看了又看</view>
    <property-card
      wx:for="{{recommendList}}"
      wx:key="id"
      property="{{item}}"
      agent-code="{{agentCode}}"
    />
    <view wx:if="{{recommendLoading}}" class="no-more">加载中...</view>
    <view wx:elif="{{recommendNoMore}}" class="no-more">没有更多了</view>
  </view>
```

（卡片间距由组件自带 `margin-bottom: 24rpx` 处理，无需额外 class，与 `my-history` 页用法一致。）

- [ ] **Step 8: index.wxss 末尾追加 `.no-more`**

文件末尾追加（该类在详情页 wxss 尚不存在，样式抄自 `pages/property-list/index.wxss:194`）：

```css
/* ── 看了又看：推荐列表 ──────────────────── */
.no-more {
  text-align: center;
  font-size: 24rpx;
  color: #ccc;
  padding: 32rpx 0;
}
```

- [ ] **Step 9: 语法检查**

```bash
cd /data/source/fang/frontend/miniprogram && node --check api/property.js && node --check pages/property-detail/index.js && node --check pages/property-list/index.js && echo OK
```

Expected: 输出 `OK`（property-list 一并检查，确认 api 导出未破坏现有引用）。

- [ ] **Step 10: 用户微信开发者工具验收清单**

以下由用户在微信开发者工具中验收（执行者无法运行小程序模拟器，向用户出示此清单）：

1. 进入任一在售房源详情，滑到底部出现“看了又看”区块，卡片正常渲染（封面/价格/户型/标题）
2. 点击卡片 → 跳转到对应房源详情页；从带 `a` 参数的海报进入时，推荐卡片跳转后归因（a 参数）保持
3. 继续上滑 → 追加下一页推荐；到底后显示“没有更多了”，继续上滑不再请求（Network 面板确认）
4. 库里只有一套在售房源时区块隐藏
5. 推荐接口断网/失败时详情页其余功能不受影响

- [ ] **Step 11: Commit**

```bash
cd /data/source/fang && git add frontend/miniprogram/api/property.js frontend/miniprogram/pages/property-detail/
git commit -m "feat(miniprogram): 房源详情页底部“看了又看”推荐，可点击进入并上滑加载更多

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

注意：`git add` 前确认 `frontend/miniprogram/pages/property-detail/` 下只有本任务改动的 4 个文件变更（`git status` 查看），不要带入工作区里已存在的无关改动（package.json/package-lock.json 是会话开始前就有的未提交改动，勿提交）。

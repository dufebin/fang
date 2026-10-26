# 房源详情页“看了又看”推荐 设计文档

- 日期：2026-10-26
- 范围：微信小程序房源详情页底部增加推荐列表，可点击进入推荐房源详情，继续下滑分页加载更多
- 涉及：后端 `backend`（Go/Gin/GORM）+ 前端 `frontend/miniprogram`

## 1. 背景与现状

房源详情页 `frontend/miniprogram/pages/property-detail/` 目前内容依次为：轮播 → 价格标题 → 数据/信任信号 → 核心卖点 → 位置与交易信息 → 基本信息 → 房源描述 → 经纪人 → 认领并推广 → 底部悬浮操作栏。滑到底部后没有任何引流内容，用户流失。

现成可复用基础设施：

- `components/property-card`：列表页在用的房源卡片组件，`property` 属性传入 `model.Property` 形状对象即可，自带封面计算与点击跳转（`wx.navigateTo` 到详情页，透传 `agentCode`）。
- `pages/property-list/index.js:68` `_loadList` + `onReachBottom`：成熟的分页加载模式（loading/noMore 防重入、`page_size=10`、`noMore = 返回条数 < PAGE_SIZE`）。
- 后端列表接口 `GET /h5/properties`（`handler/property.go:82` `List`）：支持筛选+分页（page/limit 上限 50），返回 `response.SuccessPage` 形状 `{code:0, data:{list, total, page, limit}}`。
- repo 已有 `PropertyRepo.FindByID`（`repository/property_repo.go:50`）。
- 详情页此前未使用 `onReachBottom` 钩子，无冲突。

缺口：列表接口无“排除当前房源”参数，也无相关度排序，无法直接当推荐接口用。

## 2. 关键决策

| 决策 | 选择 | 理由 |
|---|---|---|
| 目标页面 | 小程序房源详情页 | 用户确认；H5 的 PropertyDetail 本次不动（接口通用，后续可复用） |
| 推荐策略 | 相关度优先补齐：同区同型 > 同区 > 同型 > 其它在售房源，同级按 `created_at DESC` | 单条 SQL 平滑混排，推荐列表永远有内容；用户已选定 |
| 实现位置 | 后端新增推荐接口（方案 A），非前端拼接两个列表 | 分页语义干净、相关度排序一次查询完成、前端零过滤逻辑；用户已选定 |
| 首屏加载时机 | 随详情加载成功后立即预加载第一页（不 await、失败静默） | 滑到底部即刻可见，无“加载中”空窗；主流房产 App 做法；用户已选定 |
| 加载更多 | 详情页 `onReachBottom` 触发下一页 | 用户明确要求“向下滚动后再显示其它推荐” |
| 区块标题 | “看了又看” | 房产行业该场景的标准文案 |
| agentCode 透传 | 卡片带当前页 `a` 参数 | 与详情页分享/海报的推广归因行为一致 |

## 3. 后端设计

### 3.1 路由

`cmd/server/main.go` h5 组（`/api/h5`）新增一行：

```go
h5.GET("/property/:id/recommendations", propertyH.Recommendations)
```

### 3.2 Handler：`Recommendations`

`internal/handler/property.go` 新增，参数解析与现有 `List` 对齐：

- `:id` → `strconv.ParseUint`，无效返回 400
- `page` 默认 1，小于 1 归 1
- `limit` 默认 10，上限 50
- 调 `propertySvc.GetRecommendations(id, page, limit)`，`response.SuccessPage(c, list, total, page, limit)` 返回

### 3.3 Service：`GetRecommendations`

`internal/service/property_service.go` 新增：

1. `propertyRepo.FindByID(id)` 取当前房源；房源不存在 → 返回 `([]model.Property{}, 0, nil)`（详情页此时本身已是失败态，推荐无意义，不报错）
2. `propertyRepo.ListRecommendations(id, p.District, p.PropertyType, page, limit)`

### 3.4 Repo：`ListRecommendations`

`internal/repository/property_repo.go` 新增：

- 基础条件：`id != excludeID AND status != offline`（排除自身、排除下架）
- 相关度排序（参数化，district 是用户输入，禁止拼 SQL 字符串）：

```sql
ORDER BY (district = ? AND property_type = ?) DESC,
         (district = ?) DESC,
         (property_type = ?) DESC,
         created_at DESC
-- vars: district, propertyType, district, propertyType
```

district 为空时 `(district = '')` 恒 false，排序自然退化为按时间，无需特判。

- 用 GORM `db.Clauses(clause.OrderBy{Expression: clause.Expr{SQL: ..., Vars: ...}})` 传参（GORM v1.31 的 `Order()` 只接受字符串会绕过参数化）
- `Preload("Images")`（property-card 封面取 `images[0].url`，无图回退 `cover_image`）
- 先 `Count` 再 `offset/limit`，模式与现有 `List` 一致

## 4. 前端设计（小程序）

### 4.1 API 层

`api/property.js` 新增并导出：

```js
function getPropertyRecommendations(id, params) {
  return request({ url: `/h5/property/${id}/recommendations`, data: params })
}
```

返回 `data.list/total/page/limit`，与列表接口同形状。

### 4.2 页面配置

`pages/property-detail/index.json` 的 `usingComponents` 增加 `"property-card": "/components/property-card/index"`。

### 4.3 页面逻辑（index.js）

- `data` 增加：`recommendList: []`、`recommendLoading: false`、`recommendNoMore: false`
- 实例字段（不渲染）：`this._recPage = 1`；模块常量 `REC_PAGE_SIZE = 10`
- `_loadDetail` 成功 `setData` 后调用 `this._loadRecommendations()`（不 await，推荐失败不影响详情）
- `_loadRecommendations()`：

```js
if (this.data.recommendLoading || this.data.recommendNoMore) return
setData({ recommendLoading: true })
try {
  const res = await getPropertyRecommendations(this._propertyId, {
    page: this._recPage, page_size: REC_PAGE_SIZE,
  })
  const list = res.list || []
  this._recPage++
  this.setData({
    recommendList: [...this.data.recommendList, ...list],
    recommendLoading: false,
    recommendNoMore: list.length < REC_PAGE_SIZE,
  })
} catch (_) {
  this.setData({ recommendLoading: false })  // 静默；页码未增，滑到底自动重试
}
```

- `onReachBottom()`：调用 `this._loadRecommendations()`

### 4.4 页面结构（index.wxml）

插入位置：认领区块（`claim-section-new`）之后、`bottom-padding` 之前（保证悬浮操作栏不遮住最后一张卡片）：

```xml
<view wx:if="{{recommendList.length}}" class="section recommend-section">
  <view class="section-title-accent">看了又看</view>
  <property-card
    wx:for="{{recommendList}}"
    wx:key="id"
    property="{{item}}"
    agent-code="{{agentCode}}"
    class="recommend-card"
  />
  <view wx:if="{{recommendLoading}}" class="no-more">加载中...</view>
  <view wx:elif="{{recommendNoMore}}" class="no-more">没有更多了</view>
</view>
```

卡片点击由 property-card 自身处理：`wx.navigateTo` 到 `/pages/property-detail/index?id=X&a=<agentCode>`。

### 4.5 样式（index.wxss）

少量新增：`.recommend-section` 区块间距、`.recommend-card` 卡片之间的下边距、`.no-more` 底部提示样式（该类目前只存在于 property-list 的 wxss，页面样式表相互独立，详情页需自带一份，参照 `pages/property-list/index.wxss:194`）。标题复用 `section-title-accent`，区块复用 `.section`，卡片复用组件自带样式。

## 5. 边界情况

| 场景 | 行为 |
|---|---|
| 详情加载失败 | 推荐不请求（整页错误态，无推荐入口） |
| 推荐第一页请求失败 | 静默失败，区块隐藏（`recommendList` 为空）；`_recPage` 仍为 1，用户滑到底 `onReachBottom` 自动重试 |
| 全库无其它在售房源 | `recommendList` 为空，区块整体隐藏 |
| 当前房源混入推荐 | 后端 `id != excludeID` 排除 |
| 已下架房源混入推荐 | 后端 `status != offline` 排除 |
| 加载中重复上滑 | `recommendLoading` guard 防重入 |
| 已加载完继续上滑 | `recommendNoMore` guard 直接返回 |

## 6. 验证方式

项目无测试基建（后端无 `_test.go`，小程序无测试脚本），采用：

**后端（curl，启动 dev server 验证）：**

1. 排除自身：响应 `list` 中无当前 id
2. 相关度排序：选取/构造不同 district、property_type 的在售房源，验证同区同型在前、同区次之、同型再次、其它最后，同级按 `created_at DESC`
3. 分页：`page=1`/`page=2` 数据不重复且衔接排序；`page_size` 生效；`total` 正确
4. 下架房源不出现
5. 不存在的房源 id → 空列表 `total=0`，不报错

**小程序（微信开发者工具，用户验收清单）：**

1. 进入任一在售房源详情，滑到底部可见“看了又看”区块，卡片正常渲染（封面/价格/户型/标题）
2. 点击卡片 → 跳转到对应房源详情页（带 `a` 参数时归因正确）
3. 继续上滑 → 追加下一页推荐，底部出现“没有更多了”后不再请求
4. 全库仅一套房时区块隐藏
5. 推荐加载失败时不影响详情页其它功能

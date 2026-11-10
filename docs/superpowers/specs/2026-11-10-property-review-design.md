# 房源发布后台人工审核 — 设计文档

日期：2026-11-10
状态：已确认（用户已批准设计）

## 背景与目标

当前经纪人通过小程序发布房源后立即对外可见（状态直接置为 `available`），没有审核环节。需要增加后台人工审核：经纪人发布的房源须管理员审核通过后才对外可见。

## 已确认的决策

1. **审核范围**：只审经纪人（小程序）发布的房源；管理员在后台创建/编辑的房源直接上架，不经审核。
2. **编辑重审**：已通过审核的房源被经纪人再次编辑（内容变更）后，重新进入待审核状态；仅修改状态（下架/标记已售/已租）不触发重审。
3. **驳回处理**：驳回时管理员填写原因；经纪人可看到原因，修改后重新提交（回到待审核）。

## 线上兼容性约束

线上小程序已提审版本基于旧接口，新后端必须向后兼容：

- 旧版 `statusLabel` 对未知状态回退显示原始英文值（`frontend/miniprogram/utils/format.js:93`），待审核房源在旧版"我的房源"里显示为 `pending`/`rejected`，不崩溃、可接受，新版修复。
- 公开列表/搜索/详情由服务端过滤，旧版用户看不到未过审房源（预期行为）。
- 发布/编辑/删除接口的请求与响应结构不变，旧版操作流程完全正常。

## 方案

采用方案 A：扩展 `Property` 表自身状态，与 `AgentApplication` 现有审核模式（`status` + `reject_reason` + `reviewed_by` + `reviewed_at`）保持一致。不做独立审核历史表（YAGNI）。

## 数据模型（`backend/internal/model/property.go`）

- `PropertyStatus` 枚举扩展为：`pending / available / sold / rented / offline / rejected`
- 新增字段：
  - `RejectReason string` `gorm:"size:500;default:''"`
  - `ReviewedBy *uint64`
  - `ReviewedAt *time.Time`
- 迁移：GORM AutoMigrate 自动加列、改枚举。MySQL 枚举追加值对存量数据无影响，现有房源保持 `available` 不受影响。

## 后端行为

| 场景 | 行为 |
|---|---|
| 经纪人发布房源（`CreateWithOwner`） | 状态置 `pending` |
| 管理员后台创建（`Create`） | 保持现状，直接 `available` |
| 经纪人编辑已通过房源（内容字段变更） | 回到 `pending`，清空 `reject_reason` |
| 经纪人仅改状态（下架/已售/已租，`UpdateAgentPropertyStatus`） | 不触发重审，直接生效 |
| 审核通过 | `pending` → `available`，记录 `reviewed_by/reviewed_at` |
| 审核驳回 | `pending` → `rejected`，必填原因写入 `reject_reason` |
| 经纪人重新提交已驳回房源（编辑保存） | `rejected` → `pending` |

可见性规则：

- 公开接口（列表/搜索/附近/推荐/详情）：仅展示 `available / sold / rented`；`pending / rejected / offline` 对普通用户不可见。
- 经纪人自己的接口（`GetMyProperties` owner/claimed、`GetAgentPropertyDetail`、编辑/删除）：可见全部状态。
- 旧版"我的房源"（claimed tab 用的 `/agent/all-properties` 公开列表）展示已过审房源，行为不变。

新增接口：

- `PUT /admin/properties/:id/review`，body: `{ "action": "approve" | "reject", "reason": "..." }`（reject 时 reason 必填）
- 复用现有 admin 鉴权中间件。

Admin 房源列表接口需支持按 `status` 筛选（含 `pending/rejected`），返回 `reject_reason`。

## Admin 前端（`frontend/admin`）

- 「房源管理」页：
  - 状态筛选 tab（全部 / 待审核 / 在售 / 已售 / 已租 / 已下架 / 已驳回），"待审核"显示数量角标
  - 待审核行内"通过 / 驳回"操作按钮；驳回弹窗必填原因（≤500 字）
- 详情/列表展示驳回原因（已驳回房源）
- 菜单可考虑在"房源管理"上直接加角标（待审核数量），保持简单

## 小程序端（新版，`frontend/miniprogram`）

- `utils/format.js` 的 `statusLabel/statusClass` 增加 `pending: '审核中'`、`rejected: '已驳回'`（黄/红标签）
- 发布成功提示改为"已提交审核，通过后对外展示"
- "我的房源"（agent-workbench）：状态标签显示审核中/已驳回；已驳回房源展示驳回原因
- 编辑页（property-edit）：
  - 已通过房源编辑保存时提示"保存后将重新进入审核"
  - 已驳回房源进入编辑页时展示驳回原因，提交后回 `pending`
  - 待审核/已驳回房源的状态选择器隐藏或禁用（状态由审核流程控制）

## 测试

后端（Go 单测/接口测试）：

1. 经纪人发布 → 状态为 `pending`，公开列表不可见，`GetMyProperties` 可见
2. 管理员审核通过 → `available`，公开可见，`reviewed_by/at` 写入
3. 审核驳回（无原因）→ 400；有原因 → `rejected`，`reject_reason` 写入
4. 驳回后经纪人编辑保存 → 回 `pending`，`reject_reason` 清空
5. 已通过房源编辑内容 → 回 `pending`；仅改状态 → 不重审
6. 管理员创建 → 直接 `available`
7. 公开列表/详情对 `pending/rejected/offline` 均不可见

Admin 前端：列表筛选、通过/驳回交互、原因展示。

## 明确不做（YAGNI）

- 审核历史/审计日志表
- 审核结果站内通知（现有 Notification 表可支持，如需要后续单独加）
- 管理员后台创建房源走审核

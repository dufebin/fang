# 房源发布后台人工审核 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 经纪人通过小程序发布/编辑的房产房源须管理员在后台人工审核通过后才对外可见；驳回时填写原因，经纪人可修改后重新提交。

**Architecture:** 扩展现有 `properties.status` 枚举（新增 `pending`/`rejected`），照搬 `AgentApplication` 已有的审核字段模式（`reject_reason`/`reviewed_by`/`reviewed_at`）。审核核心逻辑抽成无副作用的纯函数（可单测），服务层/仓库层/HTTP 层接线；admin 前端与小程序端做对应 UI。

**Tech Stack:** Go 1.25 + Gin + GORM（MySQL，AutoMigrate 自动迁移）；admin 前端 React + Ant Design Pro Components；小程序原生 WXML/JS。

设计文档：`docs/superpowers/specs/2026-11-10-property-review-design.md`

## Global Constraints

- **线上小程序已提审版本基于旧接口，后端必须向后兼容**：发布/编辑/删除接口请求响应结构不变；旧版 `statusLabel` 对未知状态回退显示原始英文值（不崩溃，可接受）。
- 不引入任何新依赖（go.mod / package.json 均不改）。
- 管理员 JWT 的 UserID 为 0（`admin.go:97` `GenerateToken(0, "admin", ...)`），因此 `reviewed_by` 对管理员审核记录为 0，与 `AgentApplication` 现状一致。
- 后端所有 Go 代码改动后必须 `go build ./...`、`go vet ./...`、`go test ./...` 通过（在 `/data/source/fang/backend` 下执行）。
- 部署方式：`bash deploy-backend.sh`（编译+rsync+重启）、`bash deploy-admin.sh`（npm build + rsync）。小程序新版需用户在微信开发者工具上传，本计划不涉及。
- 每个任务完成后单独 commit，commit message 末尾加 `Co-Authored-By: Claude Code <noreply@anthropic.com>`。

---

### Task 1: 后端模型扩展 + 审核状态机纯函数（TDD）

**Files:**
- Modify: `backend/internal/model/property.go`
- Modify: `backend/configs/init.sql:54`
- Create: `backend/internal/service/property_review.go`
- Test: `backend/internal/service/property_review_test.go`

**Interfaces:**
- Consumes: `model.Property`（现有结构）
- Produces:
  - `model.PropertyStatusPending` / `model.PropertyStatusRejected` 常量
  - `model.Property` 新字段：`RejectReason string`（json `reject_reason`）、`ReviewedBy *uint64`（json `reviewed_by`）、`ReviewedAt *time.Time`（json `reviewed_at`）
  - `service` 包内纯函数：`applyAgentSubmit(p *model.Property)`、`reviewProperty(p *model.Property, action, reason string, adminID uint64, now time.Time) error`

- [ ] **Step 1: 写失败测试**

创建 `backend/internal/service/property_review_test.go`：

```go
package service

import (
	"testing"
	"time"

	"fangchan/internal/model"
)

func TestApplyAgentSubmit(t *testing.T) {
	p := &model.Property{Status: model.PropertyStatusAvailable, RejectReason: "图片模糊"}
	applyAgentSubmit(p)
	if p.Status != model.PropertyStatusPending {
		t.Fatalf("期望 pending，实际 %s", p.Status)
	}
	if p.RejectReason != "" {
		t.Fatalf("期望 RejectReason 被清空，实际 %q", p.RejectReason)
	}
}

func TestReviewProperty(t *testing.T) {
	now := time.Now()
	adminID := uint64(0)

	t.Run("通过待审核房源", func(t *testing.T) {
		p := &model.Property{Status: model.PropertyStatusPending, RejectReason: "旧原因"}
		if err := reviewProperty(p, "approve", "", adminID, now); err != nil {
			t.Fatalf("不期望报错: %v", err)
		}
		if p.Status != model.PropertyStatusAvailable {
			t.Fatalf("期望 available，实际 %s", p.Status)
		}
		if p.RejectReason != "" {
			t.Fatalf("期望 RejectReason 清空，实际 %q", p.RejectReason)
		}
		if p.ReviewedBy == nil || p.ReviewedAt == nil {
			t.Fatal("期望 ReviewedBy/ReviewedAt 写入")
		}
	})

	t.Run("驳回需原因", func(t *testing.T) {
		p := &model.Property{Status: model.PropertyStatusPending}
		if err := reviewProperty(p, "reject", "", adminID, now); err == nil {
			t.Fatal("无原因驳回应报错")
		}
		if err := reviewProperty(p, "reject", "标题与图片不符", adminID, now); err != nil {
			t.Fatalf("不期望报错: %v", err)
		}
		if p.Status != model.PropertyStatusRejected {
			t.Fatalf("期望 rejected，实际 %s", p.Status)
		}
		if p.RejectReason != "标题与图片不符" {
			t.Fatalf("期望驳回原因写入，实际 %q", p.RejectReason)
		}
	})

	t.Run("驳回原因限500字", func(t *testing.T) {
		p := &model.Property{Status: model.PropertyStatusPending}
		long := string(make([]rune, 501))
		for i := range long {
			long[i] = '因'
		}
		if err := reviewProperty(p, "reject", long, adminID, now); err == nil {
			t.Fatal("超长原因应报错")
		}
	})

	t.Run("仅待审核可审核", func(t *testing.T) {
		for _, st := range []model.PropertyStatus{model.PropertyStatusAvailable, model.PropertyStatusRejected, model.PropertyStatusOffline} {
			p := &model.Property{Status: st}
			if err := reviewProperty(p, "approve", "", adminID, now); err == nil {
				t.Fatalf("状态 %s 不应允许审核", st)
			}
		}
	})

	t.Run("非法操作", func(t *testing.T) {
		p := &model.Property{Status: model.PropertyStatusPending}
		if err := reviewProperty(p, "delete", "", adminID, now); err == nil {
			t.Fatal("非法 action 应报错")
		}
	})
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /data/source/fang/backend && go test ./internal/service/ -run 'TestApplyAgentSubmit|TestReviewProperty' -v`
Expected: 编译失败，`undefined: applyAgentSubmit` / `undefined: model.PropertyStatusPending` 等

- [ ] **Step 3: 扩展模型**

`backend/internal/model/property.go` — 常量块（现第 16-19 行）改为：

```go
	PropertyStatusPending   PropertyStatus = "pending"
	PropertyStatusAvailable PropertyStatus = "available"
	PropertyStatusSold      PropertyStatus = "sold"
	PropertyStatusRented    PropertyStatus = "rented"
	PropertyStatusOffline   PropertyStatus = "offline"
	PropertyStatusRejected  PropertyStatus = "rejected"
```

`Property` 结构体 `Status` 字段（现第 48 行）改为：

```go
	Status        PropertyStatus `gorm:"type:enum('pending','available','sold','rented','offline','rejected');not null;default:'available';index" json:"status"`
	RejectReason  string         `gorm:"size:500;default:''" json:"reject_reason"`
	ReviewedBy    *uint64        `json:"reviewed_by"`
	ReviewedAt    *time.Time     `json:"reviewed_at"`
```

`backend/configs/init.sql:54` 的 status 枚举同步改为：

```sql
    status ENUM('pending', 'available', 'sold', 'rented', 'offline', 'rejected') NOT NULL DEFAULT 'available' COMMENT '状态',
```

- [ ] **Step 4: 实现纯函数**

创建 `backend/internal/service/property_review.go`：

```go
package service

import (
	"fmt"
	"time"

	"fangchan/internal/model"
)

// applyAgentSubmit 经纪人发布或编辑房源后，进入待审核状态（清空历史驳回原因）
func applyAgentSubmit(p *model.Property) {
	p.Status = model.PropertyStatusPending
	p.RejectReason = ""
}

// reviewProperty 管理员审核房源：approve 通过（上架）/ reject 驳回（必填原因）
// 纯函数：只修改传入对象，不落库
func reviewProperty(p *model.Property, action, reason string, adminID uint64, now time.Time) error {
	if p.Status != model.PropertyStatusPending {
		return fmt.Errorf("仅待审核状态的房源可审核")
	}
	switch action {
	case "approve":
		p.Status = model.PropertyStatusAvailable
		p.RejectReason = ""
	case "reject":
		if reason == "" {
			return fmt.Errorf("驳回原因不能为空")
		}
		if len([]rune(reason)) > 500 {
			return fmt.Errorf("驳回原因不能超过500字")
		}
		p.Status = model.PropertyStatusRejected
		p.RejectReason = reason
	default:
		return fmt.Errorf("无效的审核操作")
	}
	p.ReviewedBy = &adminID
	p.ReviewedAt = &now
	return nil
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd /data/source/fang/backend && go test ./internal/service/ -run 'TestApplyAgentSubmit|TestReviewProperty' -v`
Expected: 全部 PASS

- [ ] **Step 6: 全量构建检查**

Run: `cd /data/source/fang/backend && go build ./... && go vet ./...`
Expected: 无错误

- [ ] **Step 7: Commit**

```bash
cd /data/source/fang
git add backend/internal/model/property.go backend/configs/init.sql backend/internal/service/property_review.go backend/internal/service/property_review_test.go
git commit -m "feat(backend): 房源状态扩展 pending/rejected + 审核状态机纯函数（含单测）

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: 后端服务层/仓库层接线（可见性过滤 + 状态流转）

**Files:**
- Modify: `backend/internal/service/property_service.go`（`CreateWithOwner` ~505 行、`UpdateProperty` 末尾 ~500 行、`GetDetailWithAgent` ~75 行、新增 `Review` 方法）
- Modify: `backend/internal/repository/property_repo.go`（`List` ~72-75 行、`HotDistricts` ~143-146 行、`ListRecommendations` ~209 行）

**Interfaces:**
- Consumes: Task 1 的 `applyAgentSubmit`、`reviewProperty`、`PropertyStatusPending/Rejected`
- Produces: `(*PropertyService).Review(id uint64, action, reason string, adminID uint64) error` — Task 3 的 handler 调用

- [ ] **Step 1: CreateWithOwner 经纪人发布进入待审核**

`property_service.go` 中 `CreateWithOwner`（~505 行）的 owner 绑定块改为：

```go
	if agent != nil {
		property.OwnerAgentID = &agent.ID
		applyAgentSubmit(property)
		_ = s.propertyRepo.Update(property)
	}
```

- [ ] **Step 2: 经纪人编辑后重新进入待审核**

`UpdateProperty`（~374 行起）末尾 `return property, s.propertyRepo.Update(property)` 之前插入：

```go
	// 经纪人编辑（非管理员）后重新进入待审核；仅改状态走 UpdateStatus，不触发重审
	if !isAdmin {
		applyAgentSubmit(property)
	}
	return property, s.propertyRepo.Update(property)
```

注意：`UpdateProperty` 同时被 admin 路由（`PUT /admin/properties/:id`）和 agent 路由（`PUT /agent/properties/:id`）使用，靠 `isAdmin` 区分，此处已天然兼容。

- [ ] **Step 3: 新增 Review 服务方法**

在 `property_service.go` 的 `UpdateStatus` 之后新增：

```go
// Review 管理员审核房源（通过/驳回）
func (s *PropertyService) Review(id uint64, action, reason string, adminID uint64) error {
	property, err := s.propertyRepo.FindByID(id)
	if err != nil || property == nil {
		return fmt.Errorf("房源不存在")
	}
	now := time.Now()
	if err := reviewProperty(property, action, reason, adminID, now); err != nil {
		return err
	}
	return s.propertyRepo.Update(property)
}
```

若 `property_service.go` 未导入 `time` 则补充 import。

- [ ] **Step 4: 公开详情隐藏未过审/下架房源**

`GetDetailWithAgent`（~75 行）`if property == nil { return nil, nil }` 之后插入：

```go
	// 公开详情页：待审核/已驳回/已下架房源不对外展示
	if property.Status == model.PropertyStatusPending ||
		property.Status == model.PropertyStatusRejected ||
		property.Status == model.PropertyStatusOffline {
		return nil, nil
	}
```

（经纪人编辑用的 `GetAgentPropertyDetail` 走独立的 `GetByID`，不受影响。）

- [ ] **Step 5: 仓库层公开列表默认只展示已过审状态**

`property_repo.go` 三处 `status != offline` 的默认过滤改为 `status IN ('available','sold','rented')`：

`List`（~72-75 行）：

```go
	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	} else if !filter.IncludeOffline {
		query = query.Where("status IN ?", []model.PropertyStatus{
			model.PropertyStatusAvailable, model.PropertyStatusSold, model.PropertyStatusRented,
		})
	}
```

`HotDistricts`（~143-146 行）：同样替换（结构相同）。

`ListRecommendations`（~209 行）改为：

```go
	query := r.db.Model(&model.Property{}).
		Where("id != ? AND status IN ?", excludeID, []model.PropertyStatus{
			model.PropertyStatusAvailable, model.PropertyStatusSold, model.PropertyStatusRented,
		})
```

**不要改** `ListByIDs`（~163 行，owner/claimed 自有列表）——经纪人需要看到自己 pending/rejected 的房源，保持只排除 offline。

- [ ] **Step 6: 构建 + 测试**

Run: `cd /data/source/fang/backend && go build ./... && go vet ./... && go test ./...`
Expected: 无错误，Task 1 测试仍 PASS

- [ ] **Step 7: Commit**

```bash
cd /data/source/fang
git add backend/internal/service/property_service.go backend/internal/repository/property_repo.go
git commit -m "feat(backend): 房源审核接线——经纪人发布/编辑进待审核，公开接口隐藏未过审房源

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: 后端 HTTP 接口（审核端点 + 防绕过校验）

**Files:**
- Modify: `backend/internal/handler/admin.go`（新增 `ReviewProperty` handler）
- Modify: `backend/internal/handler/property.go`（`List` ~121 行 status 白名单、`UpdateAgentPropertyStatus` ~476 行校验）
- Modify: `backend/cmd/server/main.go`（~285 行附近注册路由）

**Interfaces:**
- Consumes: Task 2 的 `(*PropertyService).Review(id, action, reason, adminID)`
- Produces: `PUT /api/admin/properties/:id/review`，body `{"action":"approve"|"reject","reason":"..."}`（reject 时 reason 必填，≤500 字）

- [ ] **Step 1: admin 审核 handler**

`admin.go` 中 `UpdatePropertyStatus` 之后新增（`middleware`、`strconv`、`response` 均已在 import 中）：

```go
// ReviewProperty 管理员审核房源（通过/驳回）
func (h *AdminHandler) ReviewProperty(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的房源ID")
		return
	}

	var req struct {
		Action string `json:"action" binding:"required"`
		Reason string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	adminID := middleware.GetCurrentUserID(c) // 管理员 token 的 UserID 为 0，与经纪人申请审核现状一致
	if err := h.propertySvc.Review(id, req.Action, req.Reason, adminID); err != nil {
		response.Fail(c, 400, err.Error())
		return
	}
	response.Success(c, gin.H{"reviewed": true})
}
```

- [ ] **Step 2: 注册路由**

`main.go` admin 路由组（~285 行 `admin.PUT("/properties/:id/status", ...)` 之后）加：

```go
		admin.PUT("/properties/:id/review", adminH.ReviewProperty)
```

- [ ] **Step 3: 公开列表 status 参数白名单**

`property.go` 的 `List` handler（~121 行）`filter := repository.PropertyFilter{...}` 中删掉 `Status: c.Query("status")`，在 filter 构造后加白名单：

```go
	// 公开接口只允许按已过审状态筛选，防止 status=pending/rejected/offline 泄漏未过审房源
	switch c.Query("status") {
	case "available", "sold", "rented":
		filter.Status = c.Query("status")
	}
```

- [ ] **Step 4: 经纪人状态接口防绕过校验**

`UpdateAgentPropertyStatus`（~476 行）ownership 校验（`仅房源负责人可操作`）之后、`UpdateStatus` 调用之前加：

```go
	// 审核状态机防绕过：pending/rejected 只能由审核流程改变；
	// 重新上架（→available）也必须走审核（编辑后由管理员通过）
	switch model.PropertyStatus(req.Status) {
	case model.PropertyStatusSold, model.PropertyStatusRented, model.PropertyStatusOffline:
		// 允许，直接生效，不触发重审
	case model.PropertyStatusAvailable:
		if property.Status != model.PropertyStatusAvailable {
			response.Fail(c, 400, "重新上架需编辑房源后通过审核")
			return
		}
	default:
		response.Fail(c, 400, "该状态由审核流程控制")
		return
	}
```

说明：`property.go` 需确认已导入 `fangchan/internal/model`（若无则补充 import）。

- [ ] **Step 5: 构建 + 全量测试**

Run: `cd /data/source/fang/backend && go build ./... && go vet ./... && go test ./...`
Expected: 无错误

- [ ] **Step 6: Commit**

```bash
cd /data/source/fang
git add backend/internal/handler/admin.go backend/internal/handler/property.go backend/cmd/server/main.go
git commit -m "feat(backend): 新增管理员房源审核接口；公开列表状态白名单；经纪人状态接口防绕过

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: Admin 前端审核 UI

**Files:**
- Modify: `frontend/admin/src/api/property.ts`
- Modify: `frontend/admin/src/pages/Properties/index.tsx`

**Interfaces:**
- Consumes: Task 3 的 `PUT /admin/properties/:id/review`；后端列表返回新字段 `reject_reason`
- Produces: `reviewProperty(id, action, reason?)` API 函数

- [ ] **Step 1: API 层**

`property.ts` — `Property` 接口（~33 行 `status: string` 之后）加字段：

```ts
  reject_reason?: string
```

文件末尾（`uploadPropertyVideo` 之后）加：

```ts
export const reviewProperty = (id: number, action: 'approve' | 'reject', reason?: string) =>
  request.put(`/admin/properties/${id}/review`, { action, reason })
```

- [ ] **Step 2: 页面 — 状态映射与导入**

`Properties/index.tsx`：

`STATUS_MAP`（~33 行）改为：

```ts
const STATUS_MAP: Record<string, { text: string; color: string }> = {
  pending: { text: '待审核', color: 'gold' },
  available: { text: '在售', color: 'success' },
  sold: { text: '已售', color: 'default' },
  rented: { text: '已租', color: 'blue' },
  offline: { text: '已下架', color: 'red' },
  rejected: { text: '已驳回', color: 'volcano' },
}
```

antd import（~4-6 行）补 `Modal`、`Tooltip`；api import（~13-18 行）补 `reviewProperty`：

```ts
import { Button, Space, Tag, Upload, Popconfirm, Drawer, Modal,
  Form, Input, Select, InputNumber, Row, Col, Image, App, AutoComplete, Spin, Tooltip,
} from 'antd'
```

- [ ] **Step 3: 页面 — 驳回弹窗状态**

组件内（~120 行 `useState` 区域）加：

```tsx
  const [rejectTarget, setRejectTarget] = useState<Property | null>(null)
  const [rejectReason, setRejectReason] = useState('')
```

- [ ] **Step 4: 页面 — 状态列驳回原因 Tooltip**

状态列（~313-321 行）render 改为：

```tsx
      render: (_, record) => {
        const info = STATUS_MAP[record.status] || { text: '未知', color: 'default' }
        if (record.status === 'rejected') {
          return <Tooltip title={record.reject_reason || '未填写原因'}><Tag color={info.color}>{info.text}</Tag></Tooltip>
        }
        return <Tag color={info.color}>{info.text}</Tag>
      },
```

- [ ] **Step 5: 页面 — 待审核行"通过/驳回"操作**

操作列（~322-349 行）render 数组中，`edit` 按钮之后插入：

```tsx
        record.status === 'pending' && (
          <Space key="review" size={0}>
            <Button
              type="link" size="small"
              onClick={async () => {
                await reviewProperty(record.id, 'approve')
                message.success('已通过，房源上架')
                refresh()
              }}
            >
              通过
            </Button>
            <Button type="link" size="small" danger onClick={() => setRejectTarget(record)}>
              驳回
            </Button>
          </Space>
        ),
```

- [ ] **Step 6: 页面 — 驳回原因弹窗**

`return (<> ... )` 中 ProTable 之后、新增房源 ModalForm 之前加：

```tsx
      {/* 驳回房源弹窗 */}
      <Modal
        open={!!rejectTarget}
        title="驳回房源"
        okText="确认驳回"
        okButtonProps={{ danger: true }}
        onOk={async () => {
          if (!rejectTarget) return
          const reason = rejectReason.trim()
          if (!reason) { message.warning('请填写驳回原因'); return }
          await reviewProperty(rejectTarget.id, 'reject', reason)
          message.success('已驳回')
          setRejectTarget(null)
          setRejectReason('')
          refresh()
        }}
        onCancel={() => { setRejectTarget(null); setRejectReason('') }}
      >
        <Input.TextArea
          rows={4}
          maxLength={500}
          showCount
          placeholder="请填写驳回原因（经纪人可见）"
          value={rejectReason}
          onChange={e => setRejectReason(e.target.value)}
        />
      </Modal>
```

- [ ] **Step 7: 构建**

Run: `cd /data/source/fang/frontend/admin && npm run build`
Expected: 构建成功（tsc 无类型错误）

- [ ] **Step 8: Commit**

```bash
cd /data/source/fang
git add frontend/admin/src/api/property.ts frontend/admin/src/pages/Properties/index.tsx
git commit -m "feat(admin): 房源管理支持人工审核——待审核状态、通过/驳回操作、驳回原因展示

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 5: 小程序端审核状态展示（新版）

**Files:**
- Modify: `frontend/miniprogram/utils/format.js`（~86-107 行）
- Modify: `frontend/miniprogram/app.wxss`（~105 行 tag 类附近）
- Modify: `frontend/miniprogram/components/property-card/index.wxss`（~46-48 行）
- Modify: `frontend/miniprogram/pages/property-edit/index.js`（~60-80 行加载、~300 行提交）
- Modify: `frontend/miniprogram/pages/property-edit/index.wxml`（~214 行状态选择器）
- Modify: `frontend/miniprogram/pages/property-edit/index.wxss`
- Modify: `frontend/miniprogram/pages/agent-workbench/index.wxml`（~50 行房源列表）
- Modify: `frontend/miniprogram/pages/agent-workbench/index.wxss`

**Interfaces:**
- Consumes: 后端列表/详情返回的 `status: 'pending' | 'rejected'` 与 `reject_reason` 字段（旧版线上小程序不识别，回退显示英文原值，不崩溃——已知可接受）

- [ ] **Step 1: 状态标签映射**

`format.js` `statusLabel`（~86 行）与 `statusClass`（~97 行）的 map 增加：

```js
// statusLabel map 增加：
    pending: '审核中',
    rejected: '已驳回',
// statusClass map 增加：
    pending: 'tag-yellow',
    rejected: 'tag-red',
```

`app.wxss`（~105 行 tag 类后）加：

```css
.tag-yellow { background: rgba(217, 119, 6, 0.12); color: #b45309; }
```

`components/property-card/index.wxss`（~48 行后）加：

```css
.tag-yellow { background: rgba(250, 173, 20, 0.9); color: #fff; }
```

（`tag-red` 两处已存在，无需新增。）

- [ ] **Step 2: 编辑页加载审核状态**

`property-edit/index.js` `_loadProperty` 中（~76-77 行）：

```js
      const st = p.status || 'available'
      this.setData({
        _originalStatus: st,
        status: st,
        rejectReason: p.reject_reason || '',
        reviewLocked: st === 'pending' || st === 'rejected',
```

`data` 初始值（~20、41 行附近）补：`rejectReason: ''`、`reviewLocked: false`。

- [ ] **Step 3: 编辑页 WXML — 驳回原因横幅 + 锁定状态选择器**

`property-edit/index.wxml` 状态选择器块（~214 行）改为：

```xml
    <view wx:if="{{rejectReason}}" class="reject-banner">驳回原因：{{rejectReason}}</view>
    <view class="status-row" wx:if="{{!reviewLocked}}">
      <view wx:for="{{statuses}}" wx:key="value" class="status-pill s-{{item.value}} {{status === item.value ? 's-active' : ''}}" data-val="{{item.value}}" bindtap="onStatusSelect">{{item.label}}</view>
    </view>
    <view wx:if="{{reviewLocked}}" class="review-hint">该房源{{status === 'pending' ? '正在审核中' : '审核未通过'}}，修改后提交将重新进入审核</view>
```

`property-edit/index.wxss` 末尾加：

```css
.reject-banner {
  margin: 16rpx 24rpx 0;
  padding: 16rpx 20rpx;
  background: #fef2f2;
  border: 1rpx solid #fecaca;
  border-radius: 10rpx;
  color: #b91c1c;
  font-size: 26rpx;
  line-height: 1.5;
}

.review-hint {
  margin: 16rpx 24rpx 0;
  color: #b45309;
  font-size: 24rpx;
}
```

- [ ] **Step 4: 编辑页提交 — 重审确认与文案**

`property-edit/index.js` `onSubmit` 中，校验通过后、`wx.showLoading` 之前加确认弹窗（已过审房源编辑时提醒重新进审核）：

```js
    // 已过审房源编辑保存后重新进入审核，先确认
    if (isEdit && !this.data.reviewLocked) {
      const confirmed = await new Promise((resolve) => {
        wx.showModal({
          title: '提示',
          content: '保存后房源将重新进入审核，审核通过后对外展示',
          success: (r) => resolve(r.confirm),
          fail: () => resolve(false),
        })
      })
      if (!confirmed) return
    }
```

提交成功 toast（~356 行附近）改为：

```js
      wx.showToast({ title: '已提交审核' })
```

（发布与编辑统一为"已提交审核"，两者后端都进入 pending。）

- [ ] **Step 5: 工作台"我的房源"展示驳回原因**

`agent-workbench/index.wxml`（~52-54 行）`<property-card ...>` 之后、`property-actions` 之前加：

```xml
        <view wx:if="{{item.status === 'rejected' && item.reject_reason}}" class="reject-reason">驳回原因：{{item.reject_reason}}</view>
```

`agent-workbench/index.wxss` 末尾加：

```css
.reject-reason {
  margin: 8rpx 24rpx 0;
  padding: 12rpx 20rpx;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 24rpx;
  border-radius: 8rpx;
}
```

- [ ] **Step 6: Commit**

```bash
cd /data/source/fang
git add frontend/miniprogram/utils/format.js frontend/miniprogram/app.wxss frontend/miniprogram/components/property-card/index.wxss frontend/miniprogram/pages/property-edit frontend/miniprogram/pages/agent-workbench
git commit -m "feat(miniprogram): 房源审核状态展示——审核中/已驳回标签、驳回原因、编辑重审确认

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 6: 构建、部署与线上冒烟验证

**Files:** 无代码改动（验证 + 部署）

**Interfaces:**
- Consumes: Task 1-5 全部产出

- [ ] **Step 1: 后端全量检查**

Run: `cd /data/source/fang/backend && go build ./... && go vet ./... && go test ./...`
Expected: 无错误

- [ ] **Step 2: Admin 前端构建**

Run: `cd /data/source/fang/frontend/admin && npm run build`
Expected: 构建成功

- [ ] **Step 3: 部署后端（AutoMigrate 在服务启动时自动加列/改枚举）**

Run: `cd /data/source/fang && bash deploy-backend.sh`
Expected: `started ok`，日志 `/var/log/fangserver.log` 无 AutoMigrate 报错

注意：MySQL 枚举追加新值对存量数据无影响，现有 `available` 房源不受影响。如启动失败立即回滚（重新部署上一版本二进制并排查）。

- [ ] **Step 4: 部署 Admin 前端**

Run: `cd /data/source/fang && bash deploy-admin.sh`
Expected: rsync 成功

- [ ] **Step 5: 线上冒烟（curl，覆盖设计文档测试清单）**

```bash
API="https://fapi.sanjiufangchan.cn/api"

# 1. 管理员登录拿 token
TOKEN=$(curl -s -X POST "$API/admin/login" -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}' | jq -r '.data.token')

# 2. 管理员创建房源 → 直接 available（不经审核）
curl -s -X POST "$API/admin/properties" -H "Authorization: Bearer $TOKEN" \
  -F 'title=审核冒烟测试' -F 'property_type=second_hand' -F 'city=广州' -F 'district=天河区' -F 'area=100'
# 期望: status = "available"

# 3. 置为待审核（模拟经纪人发布），验证公开不可见
PID=<上一步返回的 id>
curl -s -X PUT "$API/admin/properties/$PID/status" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"status":"pending"}'
curl -s "$API/h5/property/list?page=1&limit=50" | jq '[.data.list[].id] | index('"$PID"')'
# 期望: null（pending 公开不可见）

# 4. 驳回（无原因 → 400；有原因 → rejected）
curl -s -X PUT "$API/admin/properties/$PID/review" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"action":"reject"}'
# 期望: 400 驳回原因不能为空
curl -s -X PUT "$API/admin/properties/$PID/review" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"action":"reject","reason":"冒烟测试驳回"}'
# 期望: rejected，reject_reason = 冒烟测试驳回

# 5. 公开列表状态白名单：status=pending 不泄漏
curl -s "$API/h5/property/list?status=pending" | jq '.data.total'
# 期望: 0

# 6. 再置 pending → 审核通过 → 公开可见
curl -s -X PUT "$API/admin/properties/$PID/status" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"status":"pending"}'
curl -s -X PUT "$API/admin/properties/$PID/review" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"action":"approve"}'
curl -s "$API/h5/property/$PID" | jq '.data.status'
# 期望: available（公开可见）
```

经纪人侧流程（发布→pending、编辑→重审、驳回原因展示）无法用管理员 curl 模拟，已由 Task 1 状态机单测覆盖；请用户在微信开发者工具用开发版（请求线上 API）手动验证一次：发布房源 → 我的房源显示"审核中" → 后台驳回 → 小程序显示"已驳回+原因" → 修改重新提交 → 后台通过 → 公开可见。

- [ ] **Step 6: Admin 页面人工检查**

浏览器打开 `https://guanli.sanjiufangchan.cn`，登录后进「房源管理」：
- 状态筛选下拉出现"待审核/已驳回"选项
- 待审核行有"通过/驳回"按钮，驳回弹窗必填原因
- 已驳回状态标签悬浮显示驳回原因

- [ ] **Step 7: 提示用户**

小程序新版需用户在微信开发者工具上传并提审（本计划不改上传流程）。提醒用户：线上旧版在过渡期"我的房源"里待审核房源显示英文 `pending`，属预期，新版发布后消失。

---

## Self-Review 记录

- **Spec 覆盖**：设计文档 7 条测试项 → Task 1 单测覆盖状态机核心逻辑（发布→pending、通过、驳回+原因、驳回重提交、编辑重审）；admin 创建直接 available（6）与公开过滤（7）在 Task 6 curl 冒烟覆盖；admin 前端、小程序端均有对应任务。
- **占位符**：无 TBD/TODO；所有代码步骤给出完整代码。
- **类型一致性**：`Review(id uint64, action, reason string, adminID uint64) error` 在 Task 2 定义、Task 3 调用一致；前端 `reviewProperty`（Task 4）与后端路由（Task 3）参数一致；`reject_reason` JSON 字段名前后端一致。

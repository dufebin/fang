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

// isPublicPropertyStatus 公开状态白名单：仅这些状态的房源可被收藏、认领等用户侧操作
func isPublicPropertyStatus(s model.PropertyStatus) bool {
	return s == model.PropertyStatusAvailable || s == model.PropertyStatusSold || s == model.PropertyStatusRented
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

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
		long := make([]rune, 501)
		for i := range long {
			long[i] = '因'
		}
		if err := reviewProperty(p, "reject", string(long), adminID, now); err == nil {
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

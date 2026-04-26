package handler

import (
	"context"
	"strconv"

	"fangchan/internal/middleware"
	"fangchan/internal/service"
	"fangchan/pkg/response"
	"fangchan/pkg/wechat"

	"github.com/gin-gonic/gin"
)

type AgentHandler struct {
	agentSvc    *service.AgentService
	propertySvc *service.PropertyService
	wxClient    *wechat.Client
}

func NewAgentHandler(agentSvc *service.AgentService, propertySvc *service.PropertyService, wxClient *wechat.Client) *AgentHandler {
	return &AgentHandler{agentSvc: agentSvc, propertySvc: propertySvc, wxClient: wxClient}
}

// GetProfile 获取当前销售员档案
func (h *AgentHandler) GetProfile(c *gin.Context) {
	userID := middleware.GetCurrentUserID(c)
	agent, err := h.agentSvc.GetOrCreateAgent(userID)
	if err != nil {
		response.Fail(c, 500, err.Error())
		return
	}
	response.Success(c, agent)
}

// UpdateProfile 更新个人名片
func (h *AgentHandler) UpdateProfile(c *gin.Context) {
	userID := middleware.GetCurrentUserID(c)

	agent, err := h.agentSvc.GetOrCreateAgent(userID)
	if err != nil {
		response.Fail(c, 500, err.Error())
		return
	}

	var req service.UpdateProfileReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	updated, err := h.agentSvc.UpdateProfile(agent.ID, &req)
	if err != nil {
		response.Fail(c, 500, err.Error())
		return
	}
	response.Success(c, updated)
}

// GetMyProperties 获取我认领的房源
func (h *AgentHandler) GetMyProperties(c *gin.Context) {
	userID := middleware.GetCurrentUserID(c)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	if page < 1 {
		page = 1
	}

	agent, err := h.agentSvc.GetOrCreateAgent(userID)
	if err != nil {
		response.Fail(c, 500, err.Error())
		return
	}

	list, total, err := h.propertySvc.GetAgentProperties(agent.ID, page, limit)
	if err != nil {
		response.ServerError(c, err)
		return
	}

	response.SuccessPage(c, list, total, page, limit)
}

// GetAgentByCode 通过agent_code获取销售员主页数据（公开）
func (h *AgentHandler) GetAgentByCode(c *gin.Context) {
	agentCode := c.Param("agent_code")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	if page < 1 {
		page = 1
	}

	agent, err := h.agentSvc.FindByCode(agentCode)
	if err != nil {
		response.ServerError(c, err)
		return
	}
	if agent == nil {
		response.NotFound(c)
		return
	}

	properties, total, err := h.propertySvc.GetAgentProperties(agent.ID, page, limit)
	if err != nil {
		response.ServerError(c, err)
		return
	}

	response.Success(c, gin.H{
		"agent": gin.H{
			"id":           agent.ID,
			"name":         agent.Name,
			"phone":        agent.Phone,
			"wechat_id":    agent.WechatID,
			"wechat_qr_url": agent.WechatQRURL,
			"avatar_url":   agent.AvatarURL,
			"bio":          agent.Bio,
			"agent_code":   agent.AgentCode,
		},
		"properties": gin.H{
			"list":  properties,
			"total": total,
			"page":  page,
			"limit": limit,
		},
	})
}

// GetJSSDKConfig 获取微信JS-SDK配置
func (h *AgentHandler) GetJSSDKConfig(c *gin.Context) {
	pageURL := c.Query("url")
	if pageURL == "" {
		response.BadRequest(c, "缺少url参数")
		return
	}

	config, err := h.wxClient.GetJSSDKConfig(context.Background(), pageURL)
	if err != nil {
		response.Fail(c, 500, "获取JS-SDK配置失败: "+err.Error())
		return
	}
	response.Success(c, config)
}

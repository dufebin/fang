package handler

import (
	"strconv"

	"fangchan/internal/middleware"
	"fangchan/internal/repository"
	"fangchan/internal/service"
	"fangchan/pkg/response"

	"github.com/gin-gonic/gin"
)

type PropertyHandler struct {
	propertySvc *service.PropertyService
	agentSvc    *service.AgentService
}

func NewPropertyHandler(propertySvc *service.PropertyService, agentSvc *service.AgentService) *PropertyHandler {
	return &PropertyHandler{propertySvc: propertySvc, agentSvc: agentSvc}
}

// GetDetail H5获取房源详情（含销售员信息）
func (h *PropertyHandler) GetDetail(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的房源ID")
		return
	}

	agentCode := c.Query("a")
	detail, err := h.propertySvc.GetDetailWithAgent(id, agentCode)
	if err != nil {
		response.ServerError(c, err)
		return
	}
	if detail == nil {
		response.NotFound(c)
		return
	}

	// 异步记录浏览
	openID, _ := c.Get("open_id")
	openIDStr, _ := openID.(string)
	go h.propertySvc.RecordView(id, agentCode, openIDStr, c.ClientIP())

	response.Success(c, detail)
}

// List H5/销售员获取房源列表
func (h *PropertyHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	if page < 1 {
		page = 1
	}
	if limit > 50 {
		limit = 50
	}

	filter := repository.PropertyFilter{
		PropertyType: c.Query("type"),
		District:     c.Query("district"),
		Status:       c.Query("status"),
		Keyword:      c.Query("keyword"),
	}

	if minPrice := c.Query("min_price"); minPrice != "" {
		if v, err := strconv.ParseFloat(minPrice, 64); err == nil {
			filter.MinPrice = &v
		}
	}
	if maxPrice := c.Query("max_price"); maxPrice != "" {
		if v, err := strconv.ParseFloat(maxPrice, 64); err == nil {
			filter.MaxPrice = &v
		}
	}

	list, total, err := h.propertySvc.List(page, limit, filter)
	if err != nil {
		response.ServerError(c, err)
		return
	}

	response.SuccessPage(c, list, total, page, limit)
}

// GetAgentProperties 获取销售员认领的房源（通过agent_code）
func (h *PropertyHandler) GetAgentProperties(c *gin.Context) {
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

	list, total, err := h.propertySvc.GetAgentProperties(agent.ID, page, limit)
	if err != nil {
		response.ServerError(c, err)
		return
	}
	response.SuccessPage(c, list, total, page, limit)
}

// Create 创建房源（销售员/管理员）
func (h *PropertyHandler) Create(c *gin.Context) {
	var req service.CreatePropertyReq
	if err := c.ShouldBind(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	userID := middleware.GetCurrentUserID(c)
	property, err := h.propertySvc.CreateWithOwner(&req, userID)
	if err != nil {
		response.Fail(c, 500, err.Error())
		return
	}

	// 自动认领自己创建的房源
	_ = h.agentSvc.ClaimProperty(userID, property.ID)

	response.Success(c, property)
}

// UploadImage 上传图片
func (h *PropertyHandler) UploadImage(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的房源ID")
		return
	}

	file, header, err := c.Request.FormFile("image")
	if err != nil {
		response.BadRequest(c, "请选择图片文件")
		return
	}
	defer file.Close()

	sortOrder, _ := strconv.Atoi(c.DefaultPostForm("sort_order", "0"))

	img, err := h.propertySvc.UploadImage(id, file, header, uint8(sortOrder))
	if err != nil {
		response.Fail(c, 500, err.Error())
		return
	}

	response.Success(c, img)
}

// Claim 认领房源
func (h *PropertyHandler) Claim(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的房源ID")
		return
	}

	userID := middleware.GetCurrentUserID(c)
	if err := h.agentSvc.ClaimProperty(userID, id); err != nil {
		response.Fail(c, 500, err.Error())
		return
	}

	response.Success(c, gin.H{"claimed": true})
}

// Unclaim 取消认领
func (h *PropertyHandler) Unclaim(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的房源ID")
		return
	}

	userID := middleware.GetCurrentUserID(c)
	if err := h.agentSvc.UnclaimProperty(userID, id); err != nil {
		response.Fail(c, 500, err.Error())
		return
	}

	response.Success(c, gin.H{"unclaimed": true})
}

// UpdateProperty 更新房源（仅 owner_agent 或 admin）
func (h *PropertyHandler) UpdateProperty(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的房源ID")
		return
	}
	var req service.UpdatePropertyReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	userID := middleware.GetCurrentUserID(c)
	isAdmin := middleware.GetCurrentRole(c) == "admin"
	property, err := h.propertySvc.UpdateProperty(id, userID, isAdmin, &req)
	if err != nil {
		response.Fail(c, 403, err.Error())
		return
	}
	response.Success(c, property)
}

// UpdateStatus 更新房源状态（管理员）
func (h *PropertyHandler) UpdateStatus(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的房源ID")
		return
	}

	var req struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	if err := h.propertySvc.UpdateStatus(id, req.Status); err != nil {
		response.Fail(c, 500, err.Error())
		return
	}

	response.Success(c, gin.H{"updated": true})
}

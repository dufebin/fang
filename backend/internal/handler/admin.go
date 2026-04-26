package handler

import (
	"strconv"

	"fangchan/internal/middleware"
	"fangchan/internal/model"
	"fangchan/internal/repository"
	"fangchan/internal/service"
	"fangchan/pkg/response"

	"github.com/gin-gonic/gin"
)

type AdminHandler struct {
	propertySvc   *service.PropertyService
	agentSvc      *service.AgentService
	userRepo      *repository.UserRepo
	adminUsername string
	adminPassword string
}

func NewAdminHandler(
	propertySvc *service.PropertyService,
	agentSvc *service.AgentService,
	userRepo *repository.UserRepo,
	adminUsername, adminPassword string,
) *AdminHandler {
	return &AdminHandler{
		propertySvc:   propertySvc,
		agentSvc:      agentSvc,
		userRepo:      userRepo,
		adminUsername: adminUsername,
		adminPassword: adminPassword,
	}
}

// Login 管理员登录
func (h *AdminHandler) Login(c *gin.Context) {
	var req struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	if req.Username != h.adminUsername || req.Password != h.adminPassword {
		response.Fail(c, 401, "用户名或密码错误")
		return
	}

	token, err := middleware.GenerateToken(0, "admin", model.RoleAdmin)
	if err != nil {
		response.ServerError(c, err)
		return
	}
	response.Success(c, gin.H{"token": token})
}

// ListUsers 管理员获取用户列表
func (h *AdminHandler) ListUsers(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if page < 1 {
		page = 1
	}
	if limit > 100 {
		limit = 100
	}

	users, total, err := h.userRepo.List(page, limit, c.Query("keyword"), c.Query("role"))
	if err != nil {
		response.ServerError(c, err)
		return
	}
	response.SuccessPage(c, users, total, page, limit)
}

// ListProperties 管理员获取所有房源
func (h *AdminHandler) ListProperties(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if page < 1 {
		page = 1
	}
	if limit > 100 {
		limit = 100
	}

	filter := repository.PropertyFilter{
		PropertyType: c.Query("type"),
		District:     c.Query("district"),
		Status:       c.Query("status"),
		Keyword:      c.Query("keyword"),
	}

	list, total, err := h.propertySvc.List(page, limit, filter)
	if err != nil {
		response.ServerError(c, err)
		return
	}
	response.SuccessPage(c, list, total, page, limit)
}

// CreateProperty 管理员创建房源
func (h *AdminHandler) CreateProperty(c *gin.Context) {
	var req service.CreatePropertyReq
	if err := c.ShouldBind(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	userID := uint64(0) // admin user id from context
	if id, exists := c.Get("user_id"); exists {
		userID, _ = id.(uint64)
	}

	property, err := h.propertySvc.Create(&req, userID)
	if err != nil {
		response.Fail(c, 500, err.Error())
		return
	}
	response.Success(c, property)
}

// UploadPropertyImage 上传房源图片
func (h *AdminHandler) UploadPropertyImage(c *gin.Context) {
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

// UpdatePropertyStatus 更新房源状态
func (h *AdminHandler) UpdatePropertyStatus(c *gin.Context) {
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

// ListAgents 管理员获取销售员列表
func (h *AdminHandler) ListAgents(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if page < 1 {
		page = 1
	}

	status := c.Query("status")
	list, total, err := h.agentSvc.List(page, limit, status)
	if err != nil {
		response.ServerError(c, err)
		return
	}
	response.SuccessPage(c, list, total, page, limit)
}

// CreateAgent 管理员创建销售员
func (h *AdminHandler) CreateAgent(c *gin.Context) {
	var req service.CreateAgentReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	agent, err := h.agentSvc.CreateByAdmin(&req)
	if err != nil {
		response.Fail(c, 500, err.Error())
		return
	}
	response.Success(c, agent)
}

// SetAgentStatus 设置销售员状态
func (h *AdminHandler) SetAgentStatus(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的销售员ID")
		return
	}

	var req struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	if err := h.agentSvc.SetStatus(id, req.Status); err != nil {
		response.Fail(c, 500, err.Error())
		return
	}
	response.Success(c, gin.H{"updated": true})
}

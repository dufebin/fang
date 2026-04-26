package handler

import (
	"strconv"

	"fangchan/internal/middleware"
	"fangchan/internal/model"
	"fangchan/internal/service"
	"fangchan/pkg/response"

	"github.com/gin-gonic/gin"
)

type UserActionHandler struct {
	svc      *service.UserActionService
	agentSvc *service.AgentService
	statsSvc *service.StatsService
	appSvc   *service.AgentApplicationService
}

func NewUserActionHandler(
	svc *service.UserActionService,
	agentSvc *service.AgentService,
	statsSvc *service.StatsService,
	appSvc *service.AgentApplicationService,
) *UserActionHandler {
	return &UserActionHandler{svc: svc, agentSvc: agentSvc, statsSvc: statsSvc, appSvc: appSvc}
}

// ---- Favorites ----

// ToggleFavorite POST /user/favorites/:property_id
func (h *UserActionHandler) ToggleFavorite(c *gin.Context) {
	propertyID, err := strconv.ParseUint(c.Param("property_id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的房源ID")
		return
	}
	userID := middleware.GetCurrentUserID(c)
	favorited, err := h.svc.ToggleFavorite(userID, propertyID)
	if err != nil {
		response.Fail(c, 500, err.Error())
		return
	}
	response.Success(c, gin.H{"favorited": favorited})
}

// ListFavorites GET /user/favorites
func (h *UserActionHandler) ListFavorites(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	if page < 1 {
		page = 1
	}
	userID := middleware.GetCurrentUserID(c)
	list, total, err := h.svc.ListFavorites(userID, page, limit)
	if err != nil {
		response.ServerError(c, err)
		return
	}
	response.SuccessPage(c, list, total, page, limit)
}

// ---- Appointments ----

// CreateAppointment POST /user/appointments
func (h *UserActionHandler) CreateAppointment(c *gin.Context) {
	var req service.CreateAppointmentReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	userID := middleware.GetCurrentUserID(c)
	appt, err := h.svc.CreateAppointment(userID, &req)
	if err != nil {
		response.Fail(c, 500, err.Error())
		return
	}
	response.Success(c, appt)
}

// ListUserAppointments GET /user/appointments
func (h *UserActionHandler) ListUserAppointments(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	if page < 1 {
		page = 1
	}
	userID := middleware.GetCurrentUserID(c)
	list, total, err := h.svc.ListUserAppointments(userID, page, limit)
	if err != nil {
		response.ServerError(c, err)
		return
	}
	response.SuccessPage(c, list, total, page, limit)
}

// CancelAppointment PUT /user/appointments/:id/cancel
func (h *UserActionHandler) CancelAppointment(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的预约ID")
		return
	}
	userID := middleware.GetCurrentUserID(c)
	if err := h.svc.CancelAppointment(id, userID); err != nil {
		response.Fail(c, 500, err.Error())
		return
	}
	response.Success(c, gin.H{"cancelled": true})
}

// ---- Browse History ----

// ListBrowseHistory GET /user/history
func (h *UserActionHandler) ListBrowseHistory(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	if page < 1 {
		page = 1
	}
	userID := middleware.GetCurrentUserID(c)
	list, total, err := h.svc.ListBrowseHistory(userID, page, limit)
	if err != nil {
		response.ServerError(c, err)
		return
	}
	response.SuccessPage(c, list, total, page, limit)
}

// ---- Notifications ----

// ListNotifications GET /user/notifications
func (h *UserActionHandler) ListNotifications(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if page < 1 {
		page = 1
	}
	userID := middleware.GetCurrentUserID(c)
	list, total, err := h.svc.ListNotifications(userID, page, limit)
	if err != nil {
		response.ServerError(c, err)
		return
	}
	unread, _ := h.svc.UnreadCount(userID)
	response.Success(c, gin.H{
		"list":   list,
		"total":  total,
		"unread": unread,
		"page":   page,
		"limit":  limit,
	})
}

// MarkNotificationRead PUT /user/notifications/:id/read
func (h *UserActionHandler) MarkNotificationRead(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的通知ID")
		return
	}
	userID := middleware.GetCurrentUserID(c)
	if err := h.svc.MarkRead(id, userID); err != nil {
		response.Fail(c, 500, err.Error())
		return
	}
	response.Success(c, gin.H{"read": true})
}

// MarkAllNotificationsRead PUT /user/notifications/read-all
func (h *UserActionHandler) MarkAllNotificationsRead(c *gin.Context) {
	userID := middleware.GetCurrentUserID(c)
	if err := h.svc.MarkAllRead(userID); err != nil {
		response.Fail(c, 500, err.Error())
		return
	}
	response.Success(c, gin.H{"read": true})
}

// ---- Agent Workbench ----

// ListAgentAppointments GET /agent/appointments
func (h *UserActionHandler) ListAgentAppointments(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	if page < 1 {
		page = 1
	}
	userID := middleware.GetCurrentUserID(c)
	agent, err := h.agentSvc.GetOrCreateAgent(userID)
	if err != nil {
		response.Fail(c, 500, err.Error())
		return
	}
	list, total, err := h.svc.ListAgentAppointments(agent.ID, c.Query("status"), page, limit)
	if err != nil {
		response.ServerError(c, err)
		return
	}
	response.SuccessPage(c, list, total, page, limit)
}

// UpdateAgentAppointmentStatus PUT /agent/appointments/:id/status
func (h *UserActionHandler) UpdateAgentAppointmentStatus(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的预约ID")
		return
	}
	var req struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	userID := middleware.GetCurrentUserID(c)
	agent, err := h.agentSvc.GetOrCreateAgent(userID)
	if err != nil {
		response.Fail(c, 500, err.Error())
		return
	}
	if err := h.svc.UpdateAppointmentStatus(id, agent.ID, req.Status); err != nil {
		response.Fail(c, 500, err.Error())
		return
	}
	response.Success(c, gin.H{"updated": true})
}

// GetAgentStats GET /agent/stats
func (h *UserActionHandler) GetAgentStats(c *gin.Context) {
	userID := middleware.GetCurrentUserID(c)
	agent, err := h.agentSvc.GetOrCreateAgent(userID)
	if err != nil {
		response.Fail(c, 500, err.Error())
		return
	}
	stats, err := h.statsSvc.AgentStats(agent.ID)
	if err != nil {
		response.ServerError(c, err)
		return
	}
	response.Success(c, stats)
}

// ---- Agent Application ----

// SubmitApplication POST /user/agent-apply
func (h *UserActionHandler) SubmitApplication(c *gin.Context) {
	var req service.SubmitApplicationReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	userID := middleware.GetCurrentUserID(c)
	a, err := h.appSvc.Submit(userID, &req)
	if err != nil {
		response.Fail(c, 400, err.Error())
		return
	}
	response.Success(c, a)
}

// GetMyApplication GET /user/agent-apply
func (h *UserActionHandler) GetMyApplication(c *gin.Context) {
	userID := middleware.GetCurrentUserID(c)
	a, err := h.appSvc.GetByUser(userID)
	if err != nil {
		response.ServerError(c, err)
		return
	}
	response.Success(c, a)
}

// ---- Admin ----

// AdminListAppointments GET /admin/appointments
func (h *UserActionHandler) AdminListAppointments(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	if page < 1 {
		page = 1
	}
	list, total, err := h.svc.ListAllAppointments(c.Query("status"), page, limit)
	if err != nil {
		response.ServerError(c, err)
		return
	}
	response.SuccessPage(c, list, total, page, limit)
}

// AdminUpdateAppointmentStatus PUT /admin/appointments/:id/status
func (h *UserActionHandler) AdminUpdateAppointmentStatus(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的预约ID")
		return
	}
	var req struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if err := h.svc.AdminUpdateAppointmentStatus(id, req.Status); err != nil {
		response.Fail(c, 500, err.Error())
		return
	}
	response.Success(c, gin.H{"updated": true})
}

// AdminListApplications GET /admin/applications
func (h *UserActionHandler) AdminListApplications(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	if page < 1 {
		page = 1
	}
	list, total, err := h.appSvc.List(c.Query("status"), page, limit)
	if err != nil {
		response.ServerError(c, err)
		return
	}
	response.SuccessPage(c, list, total, page, limit)
}

// AdminReviewApplication PUT /admin/applications/:id/review
func (h *UserActionHandler) AdminReviewApplication(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的申请ID")
		return
	}
	var req service.ReviewReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	reviewerID := middleware.GetCurrentUserID(c)
	if err := h.appSvc.Review(id, reviewerID, &req); err != nil {
		response.Fail(c, 500, err.Error())
		return
	}
	response.Success(c, gin.H{"reviewed": true})
}

// AdminBroadcast POST /admin/notifications/broadcast
func (h *UserActionHandler) AdminBroadcast(c *gin.Context) {
	var req struct {
		Title   string `json:"title" binding:"required"`
		Content string `json:"content"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if err := h.svc.Broadcast(req.Title, req.Content); err != nil {
		response.Fail(c, 500, err.Error())
		return
	}
	response.Success(c, gin.H{"sent": true})
}

// AdminSendNotification POST /admin/notifications/send
func (h *UserActionHandler) AdminSendNotification(c *gin.Context) {
	var req struct {
		UserID  uint64 `json:"user_id" binding:"required"`
		Title   string `json:"title" binding:"required"`
		Content string `json:"content"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if err := h.svc.SendNotification(req.UserID, model.NotificationTypeSystem, req.Title, req.Content, nil); err != nil {
		response.Fail(c, 500, err.Error())
		return
	}
	response.Success(c, gin.H{"sent": true})
}

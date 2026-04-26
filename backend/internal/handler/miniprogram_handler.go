package handler

import (
	"fangchan/internal/middleware"
	"fangchan/internal/service"
	"fangchan/pkg/response"
	"fangchan/pkg/wechat"

	"github.com/gin-gonic/gin"
)

type MiniProgramHandler struct {
	authSvc  *service.AuthService
	wxClient *wechat.Client
}

func NewMiniProgramHandler(authSvc *service.AuthService, wxClient *wechat.Client) *MiniProgramHandler {
	return &MiniProgramHandler{authSvc: authSvc, wxClient: wxClient}
}

// Login POST /miniprogram/login
// 小程序 wx.login 换取 JWT
func (h *MiniProgramHandler) Login(c *gin.Context) {
	var req struct {
		Code     string `json:"code" binding:"required"`
		Nickname string `json:"nickname"`
		Avatar   string `json:"avatar"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "code 不能为空")
		return
	}

	session, err := h.wxClient.Jscode2Session(req.Code)
	if err != nil {
		response.Fail(c, 400, "微信登录失败: "+err.Error())
		return
	}

	user, token, err := h.authSvc.LoginOrRegisterByOpenID(session.OpenID, session.UnionID, req.Nickname, req.Avatar)
	if err != nil {
		response.Fail(c, 500, err.Error())
		return
	}

	response.Success(c, gin.H{
		"token": token,
		"user":  user,
	})
}

// UpdateProfile PUT /miniprogram/profile
// 更新微信小程序用户资料（昵称/头像需用户授权后由前端传入）
func (h *MiniProgramHandler) UpdateProfile(c *gin.Context) {
	var req struct {
		Nickname string `json:"nickname"`
		Avatar   string `json:"avatar"`
		Phone    string `json:"phone"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	userID := middleware.GetCurrentUserID(c)
	user, err := h.authSvc.UpdateUserProfile(userID, req.Nickname, req.Avatar, req.Phone)
	if err != nil {
		response.Fail(c, 500, err.Error())
		return
	}
	response.Success(c, user)
}

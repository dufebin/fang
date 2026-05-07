package handler

import (
	"fangchan/internal/middleware"
	"fangchan/internal/model"
	"fangchan/internal/service"
	"fangchan/pkg/response"
	"fangchan/pkg/wechat"

	"github.com/gin-gonic/gin"
)

type MiniProgramHandler struct {
	authSvc  *service.AuthService
	agentSvc *service.AgentService
	wxClient *wechat.Client
	env      string
}

func NewMiniProgramHandler(authSvc *service.AuthService, agentSvc *service.AgentService, wxClient *wechat.Client, env string) *MiniProgramHandler {
	return &MiniProgramHandler{authSvc: authSvc, agentSvc: agentSvc, wxClient: wxClient, env: env}
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

// DevMockAgentLogin POST /dev/mock-agent-login（仅开发环境）
func (h *MiniProgramHandler) DevMockAgentLogin(c *gin.Context) {
	if h.env == "production" {
		response.Fail(c, 403, "仅开发环境可用")
		return
	}

	const mockOpenID = "dev_mock_agent_001"
	user, _, err := h.authSvc.LoginOrRegisterByOpenID(mockOpenID, "", "测试经纪人", "")
	if err != nil {
		response.Fail(c, 500, "创建用户失败: "+err.Error())
		return
	}

	if user.Role != model.RoleAgent {
		if err := h.authSvc.UpdateUserRole(user.ID, model.RoleAgent); err != nil {
			response.Fail(c, 500, "设置角色失败: "+err.Error())
			return
		}
	}

	agent, err := h.agentSvc.FindByUserID(user.ID)
	if err != nil {
		response.Fail(c, 500, "查询经纪人失败: "+err.Error())
		return
	}
	if agent == nil {
		agent, err = h.agentSvc.CreateMockAgent(user.ID, user.Nickname)
		if err != nil {
			response.Fail(c, 500, "创建经纪人失败: "+err.Error())
			return
		}
	}

	token, err := middleware.GenerateToken(user.ID, user.OpenID, model.RoleAgent)
	if err != nil {
		response.Fail(c, 500, "生成token失败: "+err.Error())
		return
	}

	response.Success(c, gin.H{
		"token":    token,
		"role":     model.RoleAgent,
		"agent_id": agent.ID,
		"nickname": user.Nickname,
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

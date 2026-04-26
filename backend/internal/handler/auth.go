package handler

import (
	"fangchan/internal/middleware"
	"fangchan/internal/service"
	"fangchan/pkg/response"

	"github.com/gin-gonic/gin"
)

type AuthHandler struct {
	authSvc *service.AuthService
	wxAppID string
	wxRedirectURL string
}

func NewAuthHandler(authSvc *service.AuthService, wxAppID, wxRedirectURL string) *AuthHandler {
	return &AuthHandler{
		authSvc:       authSvc,
		wxAppID:       wxAppID,
		wxRedirectURL: wxRedirectURL,
	}
}

// WeChatCallback 微信OAuth回调
func (h *AuthHandler) WeChatCallback(c *gin.Context) {
	code := c.Query("code")
	if code == "" {
		response.BadRequest(c, "缺少code参数")
		return
	}

	result, err := h.authSvc.WeChatLogin(code)
	if err != nil {
		response.Fail(c, 500, "微信登录失败: "+err.Error())
		return
	}

	response.Success(c, result)
}

// WeChatRedirect 重定向到微信授权页（开发/测试用）
func (h *AuthHandler) WeChatRedirect(c *gin.Context) {
	redirectTo := c.Query("redirect_to")
	if redirectTo == "" {
		redirectTo = h.wxRedirectURL
	}

	authURL := "https://open.weixin.qq.com/connect/oauth2/authorize" +
		"?appid=" + h.wxAppID +
		"&redirect_uri=" + redirectTo +
		"&response_type=code" +
		"&scope=snsapi_userinfo" +
		"&state=login" +
		"#wechat_redirect"

	c.Redirect(302, authURL)
}

// Me 获取当前用户信息
func (h *AuthHandler) Me(c *gin.Context) {
	userID := middleware.GetCurrentUserID(c)
	role := middleware.GetCurrentRole(c)
	openID, _ := c.Get("open_id")

	response.Success(c, gin.H{
		"user_id": userID,
		"open_id": openID,
		"role":    role,
	})
}

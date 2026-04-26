package wechat

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/redis/go-redis/v9"
	"golang.org/x/net/context"
)

const (
	oauthTokenURL   = "https://api.weixin.qq.com/sns/oauth2/access_token"
	userInfoURL     = "https://api.weixin.qq.com/sns/userinfo"
	accessTokenURL  = "https://api.weixin.qq.com/cgi-bin/token"
	jscode2sessionURL = "https://api.weixin.qq.com/sns/jscode2session"
)

type Client struct {
	AppID     string
	AppSecret string
	rdb       *redis.Client
}

type OAuthToken struct {
	AccessToken  string `json:"access_token"`
	ExpiresIn    int    `json:"expires_in"`
	RefreshToken string `json:"refresh_token"`
	OpenID       string `json:"openid"`
	Scope        string `json:"scope"`
	UnionID      string `json:"unionid"`
	ErrCode      int    `json:"errcode"`
	ErrMsg       string `json:"errmsg"`
}

type UserInfo struct {
	OpenID     string   `json:"openid"`
	Nickname   string   `json:"nickname"`
	Sex        int      `json:"sex"`
	Province   string   `json:"province"`
	City       string   `json:"city"`
	Country    string   `json:"country"`
	HeadImgURL string   `json:"headimgurl"`
	Privilege  []string `json:"privilege"`
	UnionID    string   `json:"unionid"`
	ErrCode    int      `json:"errcode"`
	ErrMsg     string   `json:"errmsg"`
}

type AccessTokenResp struct {
	AccessToken string `json:"access_token"`
	ExpiresIn   int    `json:"expires_in"`
	ErrCode     int    `json:"errcode"`
	ErrMsg      string `json:"errmsg"`
}

func NewClient(appID, appSecret string, rdb *redis.Client) *Client {
	return &Client{
		AppID:     appID,
		AppSecret: appSecret,
		rdb:       rdb,
	}
}

// GetOAuthRedirectURL 生成网页授权URL
func (c *Client) GetOAuthRedirectURL(redirectURI, state string) string {
	params := url.Values{}
	params.Set("appid", c.AppID)
	params.Set("redirect_uri", redirectURI)
	params.Set("response_type", "code")
	params.Set("scope", "snsapi_userinfo")
	params.Set("state", state)
	return "https://open.weixin.qq.com/connect/oauth2/authorize?" + params.Encode() + "#wechat_redirect"
}

// GetOAuthToken 通过code获取OAuth token
func (c *Client) GetOAuthToken(code string) (*OAuthToken, error) {
	params := url.Values{}
	params.Set("appid", c.AppID)
	params.Set("secret", c.AppSecret)
	params.Set("code", code)
	params.Set("grant_type", "authorization_code")

	resp, err := http.Get(oauthTokenURL + "?" + params.Encode())
	if err != nil {
		return nil, fmt.Errorf("request oauth token: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	var token OAuthToken
	if err := json.Unmarshal(body, &token); err != nil {
		return nil, fmt.Errorf("parse token: %w", err)
	}
	if token.ErrCode != 0 {
		return nil, fmt.Errorf("wechat error %d: %s", token.ErrCode, token.ErrMsg)
	}
	return &token, nil
}

// GetUserInfo 获取用户信息
func (c *Client) GetUserInfo(accessToken, openID string) (*UserInfo, error) {
	params := url.Values{}
	params.Set("access_token", accessToken)
	params.Set("openid", openID)
	params.Set("lang", "zh_CN")

	resp, err := http.Get(userInfoURL + "?" + params.Encode())
	if err != nil {
		return nil, fmt.Errorf("request user info: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	var info UserInfo
	if err := json.Unmarshal(body, &info); err != nil {
		return nil, fmt.Errorf("parse user info: %w", err)
	}
	if info.ErrCode != 0 {
		return nil, fmt.Errorf("wechat error %d: %s", info.ErrCode, info.ErrMsg)
	}
	return &info, nil
}

// Jscode2SessionResp 小程序登录响应
type Jscode2SessionResp struct {
	OpenID     string `json:"openid"`
	SessionKey string `json:"session_key"`
	UnionID    string `json:"unionid"`
	ErrCode    int    `json:"errcode"`
	ErrMsg     string `json:"errmsg"`
}

// Jscode2Session 小程序 wx.login 换取 openid
func (c *Client) Jscode2Session(code string) (*Jscode2SessionResp, error) {
	params := url.Values{}
	params.Set("appid", c.AppID)
	params.Set("secret", c.AppSecret)
	params.Set("js_code", code)
	params.Set("grant_type", "authorization_code")

	resp, err := http.Get(jscode2sessionURL + "?" + params.Encode())
	if err != nil {
		return nil, fmt.Errorf("request jscode2session: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	var result Jscode2SessionResp
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("parse response: %w", err)
	}
	if result.ErrCode != 0 {
		return nil, fmt.Errorf("wechat error %d: %s", result.ErrCode, result.ErrMsg)
	}
	return &result, nil
}

// GetAccessToken 获取全局access_token（带Redis缓存）
func (c *Client) GetAccessToken(ctx context.Context) (string, error) {
	const cacheKey = "wechat:access_token"

	// 先从缓存读
	if c.rdb != nil {
		cached, err := c.rdb.Get(ctx, cacheKey).Result()
		if err == nil {
			return cached, nil
		}
	}

	params := url.Values{}
	params.Set("grant_type", "client_credential")
	params.Set("appid", c.AppID)
	params.Set("secret", c.AppSecret)

	resp, err := http.Get(accessTokenURL + "?" + params.Encode())
	if err != nil {
		return "", fmt.Errorf("request access token: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("read response: %w", err)
	}

	var tokenResp AccessTokenResp
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return "", fmt.Errorf("parse response: %w", err)
	}
	if tokenResp.ErrCode != 0 {
		return "", fmt.Errorf("wechat error %d: %s", tokenResp.ErrCode, tokenResp.ErrMsg)
	}

	// 缓存，提前5分钟过期
	if c.rdb != nil {
		c.rdb.Set(ctx, cacheKey, tokenResp.AccessToken,
			time.Duration(tokenResp.ExpiresIn-300)*time.Second)
	}

	return tokenResp.AccessToken, nil
}

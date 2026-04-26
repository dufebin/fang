package wechat

import (
	"context"
	"crypto/sha1"
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

)

const jsTicketURL = "https://api.weixin.qq.com/cgi-bin/ticket/getticket"

type JSSDKConfig struct {
	AppID     string `json:"appId"`
	Timestamp int64  `json:"timestamp"`
	NonceStr  string `json:"nonceStr"`
	Signature string `json:"signature"`
}

type TicketResp struct {
	ErrCode   int    `json:"errcode"`
	ErrMsg    string `json:"errmsg"`
	Ticket    string `json:"ticket"`
	ExpiresIn int    `json:"expires_in"`
}

// GetJSSDKConfig 获取JS-SDK配置（含签名）
func (c *Client) GetJSSDKConfig(ctx context.Context, pageURL string) (*JSSDKConfig, error) {
	ticket, err := c.getJSTicket(ctx)
	if err != nil {
		return nil, err
	}

	timestamp := time.Now().Unix()
	nonceStr := randomString(16)

	signature := c.signJSSDK(ticket, nonceStr, timestamp, pageURL)

	return &JSSDKConfig{
		AppID:     c.AppID,
		Timestamp: timestamp,
		NonceStr:  nonceStr,
		Signature: signature,
	}, nil
}

func (c *Client) getJSTicket(ctx context.Context) (string, error) {
	const cacheKey = "wechat:js_ticket"

	if c.rdb != nil {
		if cached, err := c.rdb.Get(ctx, cacheKey).Result(); err == nil {
			return cached, nil
		}
	}

	accessToken, err := c.GetAccessToken(ctx)
	if err != nil {
		return "", err
	}

	params := url.Values{}
	params.Set("access_token", accessToken)
	params.Set("type", "jsapi")

	resp, err := http.Get(jsTicketURL + "?" + params.Encode())
	if err != nil {
		return "", fmt.Errorf("request js ticket: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var ticketResp TicketResp
	if err := json.Unmarshal(body, &ticketResp); err != nil {
		return "", err
	}
	if ticketResp.ErrCode != 0 {
		return "", fmt.Errorf("get js ticket error %d: %s", ticketResp.ErrCode, ticketResp.ErrMsg)
	}

	if c.rdb != nil {
		c.rdb.Set(ctx, cacheKey, ticketResp.Ticket,
			time.Duration(ticketResp.ExpiresIn-300)*time.Second)
	}

	return ticketResp.Ticket, nil
}

func (c *Client) signJSSDK(ticket, nonceStr string, timestamp int64, pageURL string) string {
	params := map[string]string{
		"jsapi_ticket": ticket,
		"noncestr":     nonceStr,
		"timestamp":    fmt.Sprintf("%d", timestamp),
		"url":          pageURL,
	}

	keys := make([]string, 0, len(params))
	for k := range params {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	parts := make([]string, 0, len(keys))
	for _, k := range keys {
		parts = append(parts, k+"="+params[k])
	}

	str := strings.Join(parts, "&")
	h := sha1.New()
	h.Write([]byte(str))
	return fmt.Sprintf("%x", h.Sum(nil))
}

// GetJSTicket 公开方法，供测试用
func (c *Client) GetJSTicket(ctx context.Context) (string, error) {
	return c.getJSTicket(ctx)
}

func randomString(n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[r.Intn(len(letters))]
	}
	return string(b)
}



package response

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

type PageData struct {
	List  interface{} `json:"list"`
	Total int64       `json:"total"`
	Page  int         `json:"page"`
	Limit int         `json:"limit"`
}

func Success(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, Response{
		Code:    0,
		Message: "success",
		Data:    data,
	})
}

func SuccessPage(c *gin.Context, list interface{}, total int64, page, limit int) {
	c.JSON(http.StatusOK, Response{
		Code:    0,
		Message: "success",
		Data: PageData{
			List:  list,
			Total: total,
			Page:  page,
			Limit: limit,
		},
	})
}

func Fail(c *gin.Context, code int, message string) {
	c.JSON(http.StatusOK, Response{
		Code:    code,
		Message: message,
	})
}

func BadRequest(c *gin.Context, message string) {
	c.JSON(http.StatusBadRequest, Response{
		Code:    400,
		Message: message,
	})
}

func Unauthorized(c *gin.Context, msg ...string) {
	m := "未授权，请先登录"
	if len(msg) > 0 {
		m = msg[0]
	}
	c.JSON(http.StatusUnauthorized, Response{Code: 401, Message: m})
}

func Forbidden(c *gin.Context, msg ...string) {
	m := "权限不足"
	if len(msg) > 0 {
		m = msg[0]
	}
	c.JSON(http.StatusForbidden, Response{Code: 403, Message: m})
}

func NotFound(c *gin.Context, msg ...string) {
	m := "资源不存在"
	if len(msg) > 0 {
		m = msg[0]
	}
	c.JSON(http.StatusNotFound, Response{Code: 404, Message: m})
}

func ServerError(c *gin.Context, err error, msg ...string) {
	m := "服务器内部错误"
	if len(msg) > 0 {
		m = msg[0]
	}
	c.JSON(http.StatusInternalServerError, Response{Code: 500, Message: m})
}

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

func Unauthorized(c *gin.Context) {
	c.JSON(http.StatusUnauthorized, Response{
		Code:    401,
		Message: "未授权，请先登录",
	})
}

func Forbidden(c *gin.Context) {
	c.JSON(http.StatusForbidden, Response{
		Code:    403,
		Message: "权限不足",
	})
}

func NotFound(c *gin.Context) {
	c.JSON(http.StatusNotFound, Response{
		Code:    404,
		Message: "资源不存在",
	})
}

func ServerError(c *gin.Context, err error) {
	c.JSON(http.StatusInternalServerError, Response{
		Code:    500,
		Message: "服务器内部错误",
	})
}

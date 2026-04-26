package middleware

import (
	"strings"
	"time"

	"fangchan/internal/model"
	"fangchan/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	UserID uint64     `json:"user_id"`
	OpenID string     `json:"open_id"`
	Role   model.Role `json:"role"`
	jwt.RegisteredClaims
}

var jwtSecret []byte

func SetJWTSecret(secret string) {
	jwtSecret = []byte(secret)
}

func GenerateToken(userID uint64, openID string, role model.Role) (string, error) {
	claims := Claims{
		UserID: userID,
		OpenID: openID,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(72 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

func ParseToken(tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		return jwtSecret, nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, jwt.ErrTokenInvalidClaims
	}
	return claims, nil
}

// AuthRequired JWT认证中间件
func AuthRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		token := extractToken(c)
		if token == "" {
			response.Unauthorized(c)
			c.Abort()
			return
		}

		claims, err := ParseToken(token)
		if err != nil {
			response.Unauthorized(c)
			c.Abort()
			return
		}

		c.Set("user_id", claims.UserID)
		c.Set("open_id", claims.OpenID)
		c.Set("role", claims.Role)
		c.Next()
	}
}

// AdminRequired 管理员权限中间件
func AdminRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		token := extractToken(c)
		if token == "" {
			response.Unauthorized(c)
			c.Abort()
			return
		}

		claims, err := ParseToken(token)
		if err != nil {
			response.Unauthorized(c)
			c.Abort()
			return
		}

		if claims.Role != model.RoleAdmin {
			response.Forbidden(c)
			c.Abort()
			return
		}

		c.Set("user_id", claims.UserID)
		c.Set("open_id", claims.OpenID)
		c.Set("role", claims.Role)
		c.Next()
	}
}

// AgentRequired 销售员权限中间件（admin也可以通过）
func AgentRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		token := extractToken(c)
		if token == "" {
			response.Unauthorized(c)
			c.Abort()
			return
		}

		claims, err := ParseToken(token)
		if err != nil {
			response.Unauthorized(c)
			c.Abort()
			return
		}

		if claims.Role != model.RoleAgent && claims.Role != model.RoleAdmin {
			response.Forbidden(c)
			c.Abort()
			return
		}

		c.Set("user_id", claims.UserID)
		c.Set("open_id", claims.OpenID)
		c.Set("role", claims.Role)
		c.Next()
	}
}

func extractToken(c *gin.Context) string {
	// 先从Header
	bearer := c.GetHeader("Authorization")
	if strings.HasPrefix(bearer, "Bearer ") {
		return strings.TrimPrefix(bearer, "Bearer ")
	}
	// 再从Query（部分H5场景）
	return c.Query("token")
}

// GetCurrentUserID 从context获取当前用户ID
func GetCurrentUserID(c *gin.Context) uint64 {
	id, _ := c.Get("user_id")
	if v, ok := id.(uint64); ok {
		return v
	}
	return 0
}

// GetCurrentRole 从context获取当前角色
func GetCurrentRole(c *gin.Context) model.Role {
	role, _ := c.Get("role")
	if v, ok := role.(model.Role); ok {
		return v
	}
	return model.RoleUser
}

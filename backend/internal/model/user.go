package model

import "time"

type Role string

const (
	RoleAdmin Role = "admin"
	RoleAgent Role = "agent"
	RoleUser  Role = "user"
)

type User struct {
	ID        uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	OpenID    string    `gorm:"uniqueIndex;size:64;not null" json:"openid"`
	UnionID   string    `gorm:"size:64;default:''" json:"unionid"`
	Nickname  string    `gorm:"size:64;not null;default:''" json:"nickname"`
	AvatarURL string    `gorm:"size:512;default:''" json:"avatar_url"`
	Role      Role      `gorm:"type:enum('admin','agent','user');not null;default:'user'" json:"role"`
	Phone     string    `gorm:"size:20;default:''" json:"phone"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (User) TableName() string { return "users" }

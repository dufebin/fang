package model

import "time"

type AgentStatus string

const (
	AgentStatusActive   AgentStatus = "active"
	AgentStatusInactive AgentStatus = "inactive"
)

type Agent struct {
	ID           uint64      `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID       uint64      `gorm:"not null;index" json:"user_id"`
	Name         string      `gorm:"size:50;not null" json:"name"`
	Phone        string      `gorm:"size:20;not null" json:"phone"`
	WechatID     string      `gorm:"size:64;default:''" json:"wechat_id"`
	WechatQRURL  string      `gorm:"size:512;default:''" json:"wechat_qr_url"`
	AvatarURL    string      `gorm:"size:512;default:''" json:"avatar_url"`
	Bio          string      `gorm:"size:200;default:''" json:"bio"`
	AgentCode    string      `gorm:"uniqueIndex;size:10;not null" json:"agent_code"`
	Status       AgentStatus `gorm:"type:enum('active','inactive');not null;default:'active'" json:"status"`
	CreatedAt    time.Time   `json:"created_at"`
	UpdatedAt    time.Time   `json:"updated_at"`

	User       *User      `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Properties []Property `gorm:"many2many:agent_properties;" json:"properties,omitempty"`
}

func (Agent) TableName() string { return "agents" }

type AgentProperty struct {
	ID         uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	AgentID    uint64    `gorm:"uniqueIndex:uk_agent_property;not null;index" json:"agent_id"`
	PropertyID uint64    `gorm:"uniqueIndex:uk_agent_property;not null;index" json:"property_id"`
	ClaimedAt  time.Time `gorm:"autoCreateTime" json:"claimed_at"`
}

func (AgentProperty) TableName() string { return "agent_properties" }

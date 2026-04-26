package model

import "time"

type ApplicationStatus string

const (
	ApplicationStatusPending  ApplicationStatus = "pending"
	ApplicationStatusApproved ApplicationStatus = "approved"
	ApplicationStatusRejected ApplicationStatus = "rejected"
)

type AgentApplication struct {
	ID           uint64            `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID       uint64            `gorm:"not null;index" json:"user_id"`
	RealName     string            `gorm:"size:50;not null" json:"real_name"`
	IDCard       string            `gorm:"size:20;default:''" json:"id_card"`
	LicenseNo    string            `gorm:"size:50;default:''" json:"license_no"`
	Company      string            `gorm:"size:100;default:''" json:"company"`
	Intro        string            `gorm:"type:text" json:"intro"`
	Status       ApplicationStatus `gorm:"type:enum('pending','approved','rejected');not null;default:'pending';index" json:"status"`
	RejectReason string            `gorm:"size:500;default:''" json:"reject_reason"`
	ReviewedBy   *uint64           `json:"reviewed_by"`
	ReviewedAt   *time.Time        `json:"reviewed_at"`
	CreatedAt    time.Time         `json:"created_at"`
	UpdatedAt    time.Time         `json:"updated_at"`

	User *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (AgentApplication) TableName() string { return "agent_applications" }

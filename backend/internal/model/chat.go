package model

import "time"

type ChatMessage struct {
	ID             uint64     `gorm:"primaryKey;autoIncrement" json:"id"`
	FromUserID     uint64     `gorm:"not null;index:idx_chat_from;index:idx_chat_conv" json:"from_user_id"`
	ToUserID       uint64     `gorm:"not null;index:idx_chat_to;index:idx_chat_conv" json:"to_user_id"`
	Content        string     `gorm:"type:varchar(500);not null" json:"content"`
	IsRead         bool       `gorm:"not null;default:false" json:"is_read"`
	ReadAt         *time.Time `gorm:"index" json:"-"`
	DeletedForFrom bool       `gorm:"not null;default:false" json:"-"`
	DeletedForTo   bool       `gorm:"not null;default:false" json:"-"`
	CreatedAt      time.Time  `gorm:"index" json:"created_at"`

	FromUser *User `gorm:"foreignKey:FromUserID" json:"from_user,omitempty"`
	ToUser   *User `gorm:"foreignKey:ToUserID" json:"to_user,omitempty"`
}

func (ChatMessage) TableName() string { return "chat_messages" }

package model

import "time"

type Favorite struct {
	ID         uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID     uint64    `gorm:"uniqueIndex:uk_fav;not null;index" json:"user_id"`
	PropertyID uint64    `gorm:"uniqueIndex:uk_fav;not null;index" json:"property_id"`
	CreatedAt  time.Time `json:"created_at"`

	Property *Property `gorm:"foreignKey:PropertyID" json:"property,omitempty"`
}

func (Favorite) TableName() string { return "favorites" }

type AppointmentStatus string

const (
	AppointmentStatusPending   AppointmentStatus = "pending"
	AppointmentStatusConfirmed AppointmentStatus = "confirmed"
	AppointmentStatusCompleted AppointmentStatus = "completed"
	AppointmentStatusCancelled AppointmentStatus = "cancelled"
)

type Appointment struct {
	ID         uint64            `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID     uint64            `gorm:"not null;index" json:"user_id"`
	PropertyID uint64            `gorm:"not null;index" json:"property_id"`
	AgentID    *uint64           `gorm:"index" json:"agent_id"`
	VisitDate  string            `gorm:"type:date;not null" json:"visit_date"`
	TimeSlot   string            `gorm:"size:20;default:''" json:"time_slot"`
	Name       string            `gorm:"size:50;not null" json:"name"`
	Phone      string            `gorm:"size:20;not null" json:"phone"`
	Remark     string            `gorm:"size:500;default:''" json:"remark"`
	Status     AppointmentStatus `gorm:"type:enum('pending','confirmed','completed','cancelled');not null;default:'pending';index" json:"status"`
	CreatedAt  time.Time         `json:"created_at"`
	UpdatedAt  time.Time         `json:"updated_at"`

	Property *Property `gorm:"foreignKey:PropertyID" json:"property,omitempty"`
	Agent    *Agent    `gorm:"foreignKey:AgentID" json:"agent,omitempty"`
}

func (Appointment) TableName() string { return "appointments" }

type BrowseHistory struct {
	ID         uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID     uint64    `gorm:"not null;index" json:"user_id"`
	PropertyID uint64    `gorm:"not null;index" json:"property_id"`
	AgentCode  string    `gorm:"size:10;default:''" json:"agent_code"`
	ViewedAt   time.Time `gorm:"autoCreateTime;index" json:"viewed_at"`

	Property *Property `gorm:"foreignKey:PropertyID" json:"property,omitempty"`
}

func (BrowseHistory) TableName() string { return "browse_histories" }

type NotificationType string

const (
	NotificationTypeAppointment NotificationType = "appointment"
	NotificationTypeSystem      NotificationType = "system"
	NotificationTypeProperty    NotificationType = "property"
)

type Notification struct {
	ID        uint64           `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID    uint64           `gorm:"not null;index" json:"user_id"`
	Type      NotificationType `gorm:"type:enum('appointment','system','property');not null" json:"type"`
	Title     string           `gorm:"size:100;not null" json:"title"`
	Content   string           `gorm:"type:text" json:"content"`
	IsRead    bool             `gorm:"not null;default:false" json:"is_read"`
	RelatedID *uint64          `json:"related_id"`
	CreatedAt time.Time        `gorm:"index" json:"created_at"`
}

func (Notification) TableName() string { return "notifications" }

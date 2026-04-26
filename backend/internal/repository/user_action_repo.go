package repository

import (
	"fangchan/internal/model"

	"gorm.io/gorm"
)

type UserActionRepo struct {
	db *gorm.DB
}

func NewUserActionRepo(db *gorm.DB) *UserActionRepo {
	return &UserActionRepo{db: db}
}

// ---- Favorite ----

func (r *UserActionRepo) AddFavorite(userID, propertyID uint64) error {
	return r.db.Create(&model.Favorite{UserID: userID, PropertyID: propertyID}).Error
}

func (r *UserActionRepo) RemoveFavorite(userID, propertyID uint64) error {
	return r.db.Where("user_id = ? AND property_id = ?", userID, propertyID).
		Delete(&model.Favorite{}).Error
}

func (r *UserActionRepo) IsFavorited(userID, propertyID uint64) (bool, error) {
	var count int64
	err := r.db.Model(&model.Favorite{}).
		Where("user_id = ? AND property_id = ?", userID, propertyID).Count(&count).Error
	return count > 0, err
}

func (r *UserActionRepo) ListFavorites(userID uint64, page, limit int) ([]model.Favorite, int64, error) {
	var list []model.Favorite
	var total int64

	q := r.db.Model(&model.Favorite{}).Where("user_id = ?", userID)
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := q.Preload("Property.Images", func(db *gorm.DB) *gorm.DB {
		return db.Order("sort_order ASC").Limit(1)
	}).Offset((page-1)*limit).Limit(limit).Order("created_at DESC").Find(&list).Error
	return list, total, err
}

// ---- Appointment ----

func (r *UserActionRepo) CreateAppointment(a *model.Appointment) error {
	return r.db.Create(a).Error
}

func (r *UserActionRepo) UpdateAppointmentStatus(id uint64, status model.AppointmentStatus) error {
	return r.db.Model(&model.Appointment{}).Where("id = ?", id).
		Update("status", status).Error
}

func (r *UserActionRepo) FindAppointmentByID(id uint64) (*model.Appointment, error) {
	var a model.Appointment
	err := r.db.Preload("Property").Preload("Agent").First(&a, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &a, err
}

func (r *UserActionRepo) ListUserAppointments(userID uint64, page, limit int) ([]model.Appointment, int64, error) {
	var list []model.Appointment
	var total int64

	q := r.db.Model(&model.Appointment{}).Where("user_id = ?", userID)
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := q.Preload("Property").Preload("Agent").
		Offset((page-1)*limit).Limit(limit).Order("created_at DESC").Find(&list).Error
	return list, total, err
}

func (r *UserActionRepo) ListAgentAppointments(agentID uint64, status string, page, limit int) ([]model.Appointment, int64, error) {
	var list []model.Appointment
	var total int64

	q := r.db.Model(&model.Appointment{}).Where("agent_id = ?", agentID)
	if status != "" {
		q = q.Where("status = ?", status)
	}
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := q.Preload("Property").
		Offset((page-1)*limit).Limit(limit).Order("created_at DESC").Find(&list).Error
	return list, total, err
}

func (r *UserActionRepo) ListAllAppointments(status string, page, limit int) ([]model.Appointment, int64, error) {
	var list []model.Appointment
	var total int64

	q := r.db.Model(&model.Appointment{})
	if status != "" {
		q = q.Where("status = ?", status)
	}
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := q.Preload("Property").Preload("Agent").
		Offset((page-1)*limit).Limit(limit).Order("created_at DESC").Find(&list).Error
	return list, total, err
}

// ---- BrowseHistory ----

func (r *UserActionRepo) AddBrowseHistory(h *model.BrowseHistory) error {
	// 同一用户同一房源去重，更新时间
	return r.db.Where(model.BrowseHistory{UserID: h.UserID, PropertyID: h.PropertyID}).
		Assign(model.BrowseHistory{AgentCode: h.AgentCode}).
		FirstOrCreate(h).Error
}

func (r *UserActionRepo) ListBrowseHistory(userID uint64, page, limit int) ([]model.BrowseHistory, int64, error) {
	var list []model.BrowseHistory
	var total int64

	q := r.db.Model(&model.BrowseHistory{}).Where("user_id = ?", userID)
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := q.Preload("Property.Images", func(db *gorm.DB) *gorm.DB {
		return db.Order("sort_order ASC").Limit(1)
	}).Offset((page-1)*limit).Limit(limit).Order("viewed_at DESC").Find(&list).Error
	return list, total, err
}

// ---- Notification ----

func (r *UserActionRepo) CreateNotification(n *model.Notification) error {
	return r.db.Create(n).Error
}

func (r *UserActionRepo) ListNotifications(userID uint64, page, limit int) ([]model.Notification, int64, error) {
	var list []model.Notification
	var total int64

	q := r.db.Model(&model.Notification{}).Where("user_id = ?", userID)
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := q.Offset((page-1)*limit).Limit(limit).Order("created_at DESC").Find(&list).Error
	return list, total, err
}

func (r *UserActionRepo) MarkNotificationRead(id, userID uint64) error {
	return r.db.Model(&model.Notification{}).
		Where("id = ? AND user_id = ?", id, userID).
		Update("is_read", true).Error
}

func (r *UserActionRepo) MarkAllNotificationsRead(userID uint64) error {
	return r.db.Model(&model.Notification{}).
		Where("user_id = ? AND is_read = false", userID).
		Update("is_read", true).Error
}

func (r *UserActionRepo) UnreadCount(userID uint64) (int64, error) {
	var count int64
	err := r.db.Model(&model.Notification{}).
		Where("user_id = ? AND is_read = false", userID).Count(&count).Error
	return count, err
}

func (r *UserActionRepo) BroadcastNotification(title, content string, nType model.NotificationType) error {
	// 查出所有用户ID
	var userIDs []uint64
	if err := r.db.Table("users").Pluck("id", &userIDs).Error; err != nil {
		return err
	}
	if len(userIDs) == 0 {
		return nil
	}
	notifications := make([]model.Notification, 0, len(userIDs))
	for _, uid := range userIDs {
		notifications = append(notifications, model.Notification{
			UserID:  uid,
			Type:    nType,
			Title:   title,
			Content: content,
		})
	}
	return r.db.CreateInBatches(&notifications, 100).Error
}

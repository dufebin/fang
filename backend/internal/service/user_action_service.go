package service

import (
	"fmt"

	"fangchan/internal/model"
	"fangchan/internal/repository"
)

type UserActionService struct {
	repo      *repository.UserActionRepo
	agentRepo *repository.AgentRepo
}

func NewUserActionService(repo *repository.UserActionRepo, agentRepo *repository.AgentRepo) *UserActionService {
	return &UserActionService{repo: repo, agentRepo: agentRepo}
}

// ---- Favorite ----

func (s *UserActionService) ToggleFavorite(userID, propertyID uint64) (bool, error) {
	ok, err := s.repo.IsFavorited(userID, propertyID)
	if err != nil {
		return false, err
	}
	if ok {
		return false, s.repo.RemoveFavorite(userID, propertyID)
	}
	return true, s.repo.AddFavorite(userID, propertyID)
}

func (s *UserActionService) IsFavorited(userID, propertyID uint64) (bool, error) {
	return s.repo.IsFavorited(userID, propertyID)
}

func (s *UserActionService) ListFavorites(userID uint64, page, limit int) ([]model.Favorite, int64, error) {
	return s.repo.ListFavorites(userID, page, limit)
}

// ---- Appointment ----

type CreateAppointmentReq struct {
	PropertyID uint64 `json:"property_id" binding:"required"`
	AgentCode  string `json:"agent_code"`
	VisitDate  string `json:"visit_date" binding:"required"`
	TimeSlot   string `json:"time_slot"`
	Name       string `json:"name" binding:"required"`
	Phone      string `json:"phone" binding:"required"`
	Remark     string `json:"remark"`
}

func (s *UserActionService) CreateAppointment(userID uint64, req *CreateAppointmentReq) (*model.Appointment, error) {
	appt := &model.Appointment{
		UserID:     userID,
		PropertyID: req.PropertyID,
		VisitDate:  req.VisitDate,
		TimeSlot:   req.TimeSlot,
		Name:       req.Name,
		Phone:      req.Phone,
		Remark:     req.Remark,
		Status:     model.AppointmentStatusPending,
	}
	if req.AgentCode != "" {
		agent, err := s.agentRepo.FindByCode(req.AgentCode)
		if err == nil && agent != nil {
			appt.AgentID = &agent.ID
		}
	}
	return appt, s.repo.CreateAppointment(appt)
}

func (s *UserActionService) ListUserAppointments(userID uint64, page, limit int) ([]model.Appointment, int64, error) {
	return s.repo.ListUserAppointments(userID, page, limit)
}

func (s *UserActionService) CancelAppointment(id, userID uint64) error {
	appt, err := s.repo.FindAppointmentByID(id)
	if err != nil || appt == nil {
		return fmt.Errorf("预约不存在")
	}
	if appt.UserID != userID {
		return fmt.Errorf("无权操作")
	}
	if appt.Status == model.AppointmentStatusCompleted {
		return fmt.Errorf("已完成的预约不能取消")
	}
	return s.repo.UpdateAppointmentStatus(id, model.AppointmentStatusCancelled)
}

// Agent-side

func (s *UserActionService) ListAgentAppointments(agentID uint64, status string, page, limit int) ([]model.Appointment, int64, error) {
	return s.repo.ListAgentAppointments(agentID, status, page, limit)
}

func (s *UserActionService) UpdateAppointmentStatus(id uint64, agentID uint64, status string) error {
	appt, err := s.repo.FindAppointmentByID(id)
	if err != nil || appt == nil {
		return fmt.Errorf("预约不存在")
	}
	if appt.AgentID == nil || *appt.AgentID != agentID {
		return fmt.Errorf("无权操作")
	}
	return s.repo.UpdateAppointmentStatus(id, model.AppointmentStatus(status))
}

// Admin-side

func (s *UserActionService) ListAllAppointments(status string, page, limit int) ([]model.Appointment, int64, error) {
	return s.repo.ListAllAppointments(status, page, limit)
}

func (s *UserActionService) AdminUpdateAppointmentStatus(id uint64, status string) error {
	appt, err := s.repo.FindAppointmentByID(id)
	if err != nil || appt == nil {
		return fmt.Errorf("预约不存在")
	}
	return s.repo.UpdateAppointmentStatus(id, model.AppointmentStatus(status))
}

// ---- BrowseHistory ----

func (s *UserActionService) RecordBrowse(userID, propertyID uint64, agentCode string) {
	_ = s.repo.AddBrowseHistory(&model.BrowseHistory{
		UserID:     userID,
		PropertyID: propertyID,
		AgentCode:  agentCode,
	})
}

func (s *UserActionService) ListBrowseHistory(userID uint64, page, limit int) ([]model.BrowseHistory, int64, error) {
	return s.repo.ListBrowseHistory(userID, page, limit)
}

// ---- Notification ----

func (s *UserActionService) ListNotifications(userID uint64, page, limit int) ([]model.Notification, int64, error) {
	return s.repo.ListNotifications(userID, page, limit)
}

func (s *UserActionService) MarkRead(id, userID uint64) error {
	return s.repo.MarkNotificationRead(id, userID)
}

func (s *UserActionService) MarkAllRead(userID uint64) error {
	return s.repo.MarkAllNotificationsRead(userID)
}

func (s *UserActionService) UnreadCount(userID uint64) (int64, error) {
	return s.repo.UnreadCount(userID)
}

func (s *UserActionService) Broadcast(title, content string) error {
	return s.repo.BroadcastNotification(title, content, model.NotificationTypeSystem)
}

func (s *UserActionService) SendNotification(userID uint64, nType model.NotificationType, title, content string, relatedID *uint64) error {
	return s.repo.CreateNotification(&model.Notification{
		UserID:    userID,
		Type:      nType,
		Title:     title,
		Content:   content,
		RelatedID: relatedID,
	})
}

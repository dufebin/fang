package service

import (
	"fmt"
	"time"

	"fangchan/internal/model"
	"fangchan/internal/repository"
)

type AgentApplicationService struct {
	repo      *repository.AgentApplicationRepo
	agentRepo *repository.AgentRepo
	userRepo  *repository.UserRepo
}

func NewAgentApplicationService(
	repo *repository.AgentApplicationRepo,
	agentRepo *repository.AgentRepo,
	userRepo *repository.UserRepo,
) *AgentApplicationService {
	return &AgentApplicationService{repo: repo, agentRepo: agentRepo, userRepo: userRepo}
}

type SubmitApplicationReq struct {
	RealName  string `json:"real_name" binding:"required"`
	IDCard    string `json:"id_card"`
	LicenseNo string `json:"license_no"`
	Company   string `json:"company"`
	Intro     string `json:"intro"`
}

func (s *AgentApplicationService) Submit(userID uint64, req *SubmitApplicationReq) (*model.AgentApplication, error) {
	existing, err := s.repo.FindByUserID(userID)
	if err != nil {
		return nil, err
	}
	if existing != nil && existing.Status == model.ApplicationStatusPending {
		return nil, fmt.Errorf("您已有待审核的申请，请耐心等待")
	}
	if existing != nil && existing.Status == model.ApplicationStatusApproved {
		return nil, fmt.Errorf("您已是经纪人，无需重复申请")
	}

	a := &model.AgentApplication{
		UserID:    userID,
		RealName:  req.RealName,
		IDCard:    req.IDCard,
		LicenseNo: req.LicenseNo,
		Company:   req.Company,
		Intro:     req.Intro,
		Status:    model.ApplicationStatusPending,
	}
	return a, s.repo.Create(a)
}

func (s *AgentApplicationService) GetByUser(userID uint64) (*model.AgentApplication, error) {
	return s.repo.FindByUserID(userID)
}

func (s *AgentApplicationService) List(status string, page, limit int) ([]model.AgentApplication, int64, error) {
	return s.repo.List(status, page, limit)
}

type ReviewReq struct {
	Approved     bool   `json:"approved"`
	RejectReason string `json:"reject_reason"`
}

func (s *AgentApplicationService) Review(id, reviewerID uint64, req *ReviewReq) error {
	a, err := s.repo.FindByID(id)
	if err != nil || a == nil {
		return fmt.Errorf("申请不存在")
	}
	if a.Status != model.ApplicationStatusPending {
		return fmt.Errorf("该申请已处理")
	}

	now := time.Now()
	a.ReviewedBy = &reviewerID
	a.ReviewedAt = &now

	if req.Approved {
		a.Status = model.ApplicationStatusApproved
		// 升级用户角色为 agent
		user, err := s.userRepo.FindByID(a.UserID)
		if err != nil || user == nil {
			return fmt.Errorf("用户不存在")
		}
		user.Role = model.RoleAgent
		if err := s.userRepo.Update(user); err != nil {
			return err
		}
		// 创建经纪人档案（如果不存在）
		existing, _ := s.agentRepo.FindByUserID(a.UserID)
		if existing == nil {
			agent := &model.Agent{
				UserID:    a.UserID,
				Name:      a.RealName,
				AgentCode: generateAgentCode(),
				Status:    model.AgentStatusActive,
			}
			_ = s.agentRepo.Create(agent)
		}
	} else {
		a.Status = model.ApplicationStatusRejected
		a.RejectReason = req.RejectReason
	}

	return s.repo.Update(a)
}

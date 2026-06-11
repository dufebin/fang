package service

import (
	"fmt"
	"math/rand"
	"time"

	"fangchan/internal/model"
	"fangchan/internal/repository"
)

type AgentService struct {
	agentRepo *repository.AgentRepo
	userRepo  *repository.UserRepo
}

func NewAgentService(agentRepo *repository.AgentRepo, userRepo *repository.UserRepo) *AgentService {
	return &AgentService{agentRepo: agentRepo, userRepo: userRepo}
}

type UpdateProfileReq struct {
	Name        string `json:"name"`
	Phone       string `json:"phone"`
	WechatID    string `json:"wechat_id"`
	WechatQRURL string `json:"wechat_qr_url"`
	AvatarURL   string `json:"avatar_url"`
	Bio         string `json:"bio"`
}

type CreateAgentReq struct {
	UserID   uint64 `json:"user_id" binding:"required"`
	Name     string `json:"name" binding:"required"`
	Phone    string `json:"phone" binding:"required"`
	WechatID string `json:"wechat_id"`
	Bio      string `json:"bio"`
}

// FindByUserID 通过用户ID查找经纪人档案
func (s *AgentService) FindByUserID(userID uint64) (*model.Agent, error) {
	return s.agentRepo.FindByUserID(userID)
}

// GetOrCreateAgent 获取或创建销售员档案
func (s *AgentService) GetOrCreateAgent(userID uint64) (*model.Agent, error) {
	agent, err := s.agentRepo.FindByUserID(userID)
	if err != nil {
		return nil, err
	}
	if agent != nil {
		return agent, nil
	}

	user, err := s.userRepo.FindByID(userID)
	if err != nil || user == nil {
		return nil, fmt.Errorf("用户不存在")
	}

	agent = &model.Agent{
		UserID:    userID,
		Name:      user.Nickname,
		Phone:     "",
		AvatarURL: user.AvatarURL,
		AgentCode: generateAgentCode(),
		Status:    model.AgentStatusActive,
	}
	if err := s.agentRepo.Create(agent); err != nil {
		return nil, err
	}
	return agent, nil
}

// UpdateProfile 更新销售员档案
func (s *AgentService) UpdateProfile(agentID uint64, req *UpdateProfileReq) (*model.Agent, error) {
	agent, err := s.agentRepo.FindByID(agentID)
	if err != nil || agent == nil {
		return nil, fmt.Errorf("销售员不存在")
	}

	if req.Name != "" {
		agent.Name = req.Name
	}
	if req.Phone != "" {
		agent.Phone = req.Phone
	}
	if req.WechatID != "" {
		agent.WechatID = req.WechatID
	}
	if req.WechatQRURL != "" {
		agent.WechatQRURL = req.WechatQRURL
	}
	if req.AvatarURL != "" {
		agent.AvatarURL = req.AvatarURL
	}
	if req.Bio != "" {
		agent.Bio = req.Bio
	}

	return agent, s.agentRepo.Update(agent)
}

// ClaimProperty 认领房源，任意登录用户均可认领（自动创建经纪人档案）
func (s *AgentService) ClaimProperty(userID, propertyID uint64, commission *float64) error {
	agent, err := s.GetOrCreateAgent(userID)
	if err != nil {
		return err
	}
	return s.agentRepo.ClaimProperty(agent.ID, propertyID, commission)
}

// UnclaimProperty 取消认领
func (s *AgentService) UnclaimProperty(userID, propertyID uint64) error {
	agent, err := s.agentRepo.FindByUserID(userID)
	if err != nil || agent == nil {
		return fmt.Errorf("销售员档案不存在")
	}
	return s.agentRepo.UnclaimProperty(agent.ID, propertyID)
}

// GetClaimStatus 查询用户对某房源的认领状态和佣金
func (s *AgentService) GetClaimStatus(userID, propertyID uint64) (bool, *float64, error) {
	agent, err := s.agentRepo.FindByUserID(userID)
	if err != nil || agent == nil {
		return false, nil, nil
	}
	claimed, err := s.agentRepo.IsPropertyClaimed(agent.ID, propertyID)
	if err != nil || !claimed {
		return false, nil, err
	}
	commission, _ := s.agentRepo.GetClaimCommission(agent.ID, propertyID)
	return true, commission, nil
}

// CreateByAdmin 管理员创建销售员
func (s *AgentService) CreateByAdmin(req *CreateAgentReq) (*model.Agent, error) {
	existing, err := s.agentRepo.FindByUserID(req.UserID)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, fmt.Errorf("该用户已有销售员档案")
	}

	agent := &model.Agent{
		UserID:    req.UserID,
		Name:      req.Name,
		Phone:     req.Phone,
		WechatID:  req.WechatID,
		Bio:       req.Bio,
		AgentCode: generateAgentCode(),
		Status:    model.AgentStatusActive,
	}
	return agent, s.agentRepo.Create(agent)
}

// CreateMockAgent 为开发测试创建经纪人档案（带占位手机号）
func (s *AgentService) CreateMockAgent(userID uint64, nickname string) (*model.Agent, error) {
	agent := &model.Agent{
		UserID:    userID,
		Name:      nickname,
		Phone:     "00000000000",
		AgentCode: generateAgentCode(),
		Status:    model.AgentStatusActive,
	}
	return agent, s.agentRepo.Create(agent)
}

// FindByCode 通过agent_code查找销售员
func (s *AgentService) FindByCode(code string) (*model.Agent, error) {
	return s.agentRepo.FindByCode(code)
}

// List 列表
func (s *AgentService) List(page, limit int, status string) ([]model.Agent, int64, error) {
	return s.agentRepo.List(page, limit, status)
}

// SetStatus 设置状态
func (s *AgentService) SetStatus(agentID uint64, status string) error {
	agent, err := s.agentRepo.FindByID(agentID)
	if err != nil || agent == nil {
		return fmt.Errorf("销售员不存在")
	}
	agent.Status = model.AgentStatus(status)
	return s.agentRepo.Update(agent)
}

func generateAgentCode() string {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	b := make([]byte, 6)
	for i := range b {
		b[i] = chars[r.Intn(len(chars))]
	}
	return string(b)
}

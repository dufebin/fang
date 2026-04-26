package repository

import (
	"fangchan/internal/model"

	"gorm.io/gorm"
)

type AgentRepo struct {
	db *gorm.DB
}

func NewAgentRepo(db *gorm.DB) *AgentRepo {
	return &AgentRepo{db: db}
}

func (r *AgentRepo) FindByUserID(userID uint64) (*model.Agent, error) {
	var agent model.Agent
	err := r.db.Where("user_id = ?", userID).First(&agent).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &agent, err
}

func (r *AgentRepo) FindByCode(code string) (*model.Agent, error) {
	var agent model.Agent
	err := r.db.Where("agent_code = ?", code).First(&agent).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &agent, err
}

func (r *AgentRepo) FindByID(id uint64) (*model.Agent, error) {
	var agent model.Agent
	err := r.db.First(&agent, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &agent, err
}

func (r *AgentRepo) Create(agent *model.Agent) error {
	return r.db.Create(agent).Error
}

func (r *AgentRepo) Update(agent *model.Agent) error {
	return r.db.Save(agent).Error
}

func (r *AgentRepo) List(page, limit int, status string) ([]model.Agent, int64, error) {
	var agents []model.Agent
	var total int64

	query := r.db.Model(&model.Agent{})
	if status != "" {
		query = query.Where("status = ?", status)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * limit
	err := query.Offset(offset).Limit(limit).
		Order("created_at DESC").Find(&agents).Error
	return agents, total, err
}

func (r *AgentRepo) Delete(id uint64) error {
	return r.db.Delete(&model.Agent{}, id).Error
}

// ClaimProperty 销售员认领房源
func (r *AgentRepo) ClaimProperty(agentID, propertyID uint64) error {
	ap := model.AgentProperty{AgentID: agentID, PropertyID: propertyID}
	return r.db.Where("agent_id = ? AND property_id = ?", agentID, propertyID).
		FirstOrCreate(&ap).Error
}

// UnclaimProperty 取消认领
func (r *AgentRepo) UnclaimProperty(agentID, propertyID uint64) error {
	return r.db.Where("agent_id = ? AND property_id = ?", agentID, propertyID).
		Delete(&model.AgentProperty{}).Error
}

// IsPropertyClaimed 检查是否已认领
func (r *AgentRepo) IsPropertyClaimed(agentID, propertyID uint64) (bool, error) {
	var count int64
	err := r.db.Model(&model.AgentProperty{}).
		Where("agent_id = ? AND property_id = ?", agentID, propertyID).
		Count(&count).Error
	return count > 0, err
}

// GetClaimedPropertyIDs 获取销售员认领的房源ID列表
func (r *AgentRepo) GetClaimedPropertyIDs(agentID uint64) ([]uint64, error) {
	var aps []model.AgentProperty
	err := r.db.Where("agent_id = ?", agentID).Find(&aps).Error
	if err != nil {
		return nil, err
	}
	ids := make([]uint64, len(aps))
	for i, ap := range aps {
		ids[i] = ap.PropertyID
	}
	return ids, nil
}

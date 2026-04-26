package repository

import (
	"fangchan/internal/model"

	"gorm.io/gorm"
)

type AgentApplicationRepo struct {
	db *gorm.DB
}

func NewAgentApplicationRepo(db *gorm.DB) *AgentApplicationRepo {
	return &AgentApplicationRepo{db: db}
}

func (r *AgentApplicationRepo) Create(a *model.AgentApplication) error {
	return r.db.Create(a).Error
}

func (r *AgentApplicationRepo) FindByID(id uint64) (*model.AgentApplication, error) {
	var a model.AgentApplication
	err := r.db.Preload("User").First(&a, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &a, err
}

func (r *AgentApplicationRepo) FindByUserID(userID uint64) (*model.AgentApplication, error) {
	var a model.AgentApplication
	err := r.db.Where("user_id = ?", userID).Order("created_at DESC").First(&a).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &a, err
}

func (r *AgentApplicationRepo) Update(a *model.AgentApplication) error {
	return r.db.Save(a).Error
}

func (r *AgentApplicationRepo) List(status string, page, limit int) ([]model.AgentApplication, int64, error) {
	var list []model.AgentApplication
	var total int64

	q := r.db.Model(&model.AgentApplication{})
	if status != "" {
		q = q.Where("status = ?", status)
	}
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := q.Preload("User").Offset((page-1)*limit).Limit(limit).
		Order("created_at DESC").Find(&list).Error
	return list, total, err
}

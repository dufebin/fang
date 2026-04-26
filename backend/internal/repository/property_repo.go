package repository

import (
	"fangchan/internal/model"

	"gorm.io/gorm"
)

type PropertyRepo struct {
	db *gorm.DB
}

type PropertyFilter struct {
	PropertyType string
	District     string
	Status       string
	MinPrice     *float64
	MaxPrice     *float64
	Keyword      string
}

func NewPropertyRepo(db *gorm.DB) *PropertyRepo {
	return &PropertyRepo{db: db}
}

func (r *PropertyRepo) Create(p *model.Property) error {
	return r.db.Create(p).Error
}

func (r *PropertyRepo) Update(p *model.Property) error {
	return r.db.Save(p).Error
}

func (r *PropertyRepo) Delete(id uint64) error {
	return r.db.Delete(&model.Property{}, id).Error
}

func (r *PropertyRepo) FindByID(id uint64) (*model.Property, error) {
	var p model.Property
	err := r.db.Preload("Images").First(&p, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &p, err
}

func (r *PropertyRepo) List(page, limit int, filter PropertyFilter) ([]model.Property, int64, error) {
	var properties []model.Property
	var total int64

	query := r.db.Model(&model.Property{})

	if filter.PropertyType != "" {
		query = query.Where("property_type = ?", filter.PropertyType)
	}
	if filter.District != "" {
		query = query.Where("district LIKE ?", "%"+filter.District+"%")
	}
	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	} else {
		query = query.Where("status != ?", model.PropertyStatusOffline)
	}
	if filter.MinPrice != nil {
		query = query.Where("total_price >= ?", *filter.MinPrice)
	}
	if filter.MaxPrice != nil {
		query = query.Where("total_price <= ?", *filter.MaxPrice)
	}
	if filter.Keyword != "" {
		like := "%" + filter.Keyword + "%"
		query = query.Where("title LIKE ? OR address LIKE ? OR district LIKE ?", like, like, like)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * limit
	err := query.Preload("Images", func(db *gorm.DB) *gorm.DB {
		return db.Order("sort_order ASC").Limit(1) // 只加载第一张图
	}).Offset(offset).Limit(limit).Order("created_at DESC").Find(&properties).Error

	return properties, total, err
}

// ListByIDs 按ID列表查询（销售员认领的房源）
func (r *PropertyRepo) ListByIDs(ids []uint64, page, limit int) ([]model.Property, int64, error) {
	if len(ids) == 0 {
		return []model.Property{}, 0, nil
	}

	var properties []model.Property
	var total int64

	query := r.db.Model(&model.Property{}).Where("id IN ? AND status != ?", ids, model.PropertyStatusOffline)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * limit
	err := query.Preload("Images", func(db *gorm.DB) *gorm.DB {
		return db.Order("sort_order ASC").Limit(1)
	}).Offset(offset).Limit(limit).Order("created_at DESC").Find(&properties).Error

	return properties, total, err
}

func (r *PropertyRepo) IncrViewCount(id uint64) error {
	return r.db.Model(&model.Property{}).Where("id = ?", id).
		UpdateColumn("view_count", gorm.Expr("view_count + 1")).Error
}

func (r *PropertyRepo) AddImages(images []model.PropertyImage) error {
	return r.db.Create(&images).Error
}

func (r *PropertyRepo) DeleteImages(propertyID uint64, imageIDs []uint64) error {
	return r.db.Where("property_id = ? AND id IN ?", propertyID, imageIDs).
		Delete(&model.PropertyImage{}).Error
}

func (r *PropertyRepo) RecordView(view *model.PropertyView) error {
	return r.db.Create(view).Error
}

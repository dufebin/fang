package repository

import (
	"fangchan/internal/model"

	"gorm.io/gorm"
)

type PropertyRepo struct {
	db *gorm.DB
}

type PropertyFilter struct {
	PropertyType   string
	District       string
	Status         string
	MinPrice       *float64
	MaxPrice       *float64
	MinArea        *float64
	MaxArea        *float64
	Bedrooms       *int
	Sort           string // created_at | price_asc | price_desc | area
	Keyword        string
	IncludeOffline bool
	OwnerAgentID   *uint64
	PreloadAgent   bool
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
	} else if !filter.IncludeOffline {
		query = query.Where("status != ?", model.PropertyStatusOffline)
	}
	if filter.MinPrice != nil {
		query = query.Where("total_price >= ?", *filter.MinPrice)
	}
	if filter.MaxPrice != nil {
		query = query.Where("total_price <= ?", *filter.MaxPrice)
	}
	if filter.MinArea != nil {
		query = query.Where("area >= ?", *filter.MinArea)
	}
	if filter.MaxArea != nil {
		query = query.Where("area <= ?", *filter.MaxArea)
	}
	if filter.Bedrooms != nil {
		query = query.Where("bedrooms = ?", *filter.Bedrooms)
	}
	if filter.Keyword != "" {
		like := "%" + filter.Keyword + "%"
		query = query.Where("title LIKE ? OR address LIKE ? OR district LIKE ?", like, like, like)
	}
	if filter.OwnerAgentID != nil {
		query = query.Where("owner_agent_id = ?", *filter.OwnerAgentID)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * limit
	q := query.Preload("Images", func(db *gorm.DB) *gorm.DB {
		return db.Order("sort_order ASC")
	})
	if filter.PreloadAgent {
		q = q.Preload("OwnerAgent")
	}
	switch filter.Sort {
	case "price_asc":
		q = q.Order("total_price ASC")
	case "price_desc":
		q = q.Order("total_price DESC")
	case "area":
		q = q.Order("area DESC")
	default:
		q = q.Order("created_at DESC")
	}
	err := q.Offset(offset).Limit(limit).Find(&properties).Error

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
		return db.Order("sort_order ASC")
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

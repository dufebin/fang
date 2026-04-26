package repository

import (
	"fangchan/internal/model"
	"time"

	"gorm.io/gorm"
)

type ContentRepo struct {
	db *gorm.DB
}

func NewContentRepo(db *gorm.DB) *ContentRepo {
	return &ContentRepo{db: db}
}

// ---- Article ----

type ArticleFilter struct {
	Category string
	Status   string
	Keyword  string
}

func (r *ContentRepo) CreateArticle(a *model.Article) error {
	return r.db.Create(a).Error
}

func (r *ContentRepo) UpdateArticle(a *model.Article) error {
	return r.db.Save(a).Error
}

func (r *ContentRepo) DeleteArticle(id uint64) error {
	return r.db.Delete(&model.Article{}, id).Error
}

func (r *ContentRepo) FindArticleByID(id uint64) (*model.Article, error) {
	var a model.Article
	err := r.db.First(&a, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &a, err
}

func (r *ContentRepo) ListArticles(page, limit int, f ArticleFilter) ([]model.Article, int64, error) {
	var list []model.Article
	var total int64

	q := r.db.Model(&model.Article{})
	if f.Category != "" {
		q = q.Where("category = ?", f.Category)
	}
	if f.Status != "" {
		q = q.Where("status = ?", f.Status)
	}
	if f.Keyword != "" {
		q = q.Where("title LIKE ?", "%"+f.Keyword+"%")
	}

	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := q.Omit("content").Offset((page-1)*limit).Limit(limit).
		Order("published_at DESC, created_at DESC").Find(&list).Error
	return list, total, err
}

func (r *ContentRepo) IncrArticleView(id uint64) error {
	return r.db.Model(&model.Article{}).Where("id = ?", id).
		UpdateColumn("view_count", gorm.Expr("view_count + 1")).Error
}

// ---- Banner ----

func (r *ContentRepo) CreateBanner(b *model.Banner) error {
	return r.db.Create(b).Error
}

func (r *ContentRepo) UpdateBanner(b *model.Banner) error {
	return r.db.Save(b).Error
}

func (r *ContentRepo) DeleteBanner(id uint64) error {
	return r.db.Delete(&model.Banner{}, id).Error
}

func (r *ContentRepo) ListBanners(position string, onlyActive bool) ([]model.Banner, error) {
	var list []model.Banner
	q := r.db.Model(&model.Banner{})
	if position != "" {
		q = q.Where("position = ?", position)
	}
	if onlyActive {
		q = q.Where("is_active = true")
	}
	err := q.Order("sort_order ASC").Find(&list).Error
	return list, err
}

func (r *ContentRepo) FindBannerByID(id uint64) (*model.Banner, error) {
	var b model.Banner
	err := r.db.First(&b, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &b, err
}

// ---- Area ----

func (r *ContentRepo) CreateArea(a *model.Area) error {
	return r.db.Create(a).Error
}

func (r *ContentRepo) UpdateArea(a *model.Area) error {
	return r.db.Save(a).Error
}

func (r *ContentRepo) DeleteArea(id uint64) error {
	return r.db.Delete(&model.Area{}, id).Error
}

func (r *ContentRepo) ListAreas() ([]model.Area, error) {
	var list []model.Area
	err := r.db.Where("is_active = true").Order("parent_id ASC, sort_order ASC").Find(&list).Error
	return list, err
}

func (r *ContentRepo) FindAreaByID(id uint64) (*model.Area, error) {
	var a model.Area
	err := r.db.First(&a, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &a, err
}

// PublishArticle sets status to published and records published_at
func (r *ContentRepo) PublishArticle(id uint64) error {
	now := time.Now()
	return r.db.Model(&model.Article{}).Where("id = ?", id).Updates(map[string]interface{}{
		"status":       model.ArticleStatusPublished,
		"published_at": now,
	}).Error
}

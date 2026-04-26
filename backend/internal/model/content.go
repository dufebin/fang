package model

import "time"

type ArticleCategory string
type ArticleStatus string

const (
	ArticleCategoryNews   ArticleCategory = "news"
	ArticleCategoryPolicy ArticleCategory = "policy"
	ArticleCategoryGuide  ArticleCategory = "guide"
	ArticleCategoryMarket ArticleCategory = "market"

	ArticleStatusDraft     ArticleStatus = "draft"
	ArticleStatusPublished ArticleStatus = "published"
	ArticleStatusOffline   ArticleStatus = "offline"
)

type Article struct {
	ID          uint64          `gorm:"primaryKey;autoIncrement" json:"id"`
	Title       string          `gorm:"size:200;not null" json:"title"`
	Summary     string          `gorm:"size:500;default:''" json:"summary"`
	Content     string          `gorm:"type:longtext;default:''" json:"content,omitempty"`
	CoverImage  string          `gorm:"size:512;default:''" json:"cover_image"`
	Category    ArticleCategory `gorm:"type:enum('news','policy','guide','market');not null;default:'news'" json:"category"`
	Author      string          `gorm:"size:50;default:''" json:"author"`
	ViewCount   uint32          `gorm:"not null;default:0" json:"view_count"`
	Status      ArticleStatus   `gorm:"type:enum('draft','published','offline');not null;default:'draft';index" json:"status"`
	PublishedAt *time.Time      `json:"published_at"`
	CreatedBy   uint64          `gorm:"default:0" json:"created_by"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
}

func (Article) TableName() string { return "articles" }

type BannerPosition string
type BannerLinkType string

const (
	BannerPositionHome BannerPosition = "home"
	BannerPositionList BannerPosition = "list"

	BannerLinkTypeProperty BannerLinkType = "property"
	BannerLinkTypeArticle  BannerLinkType = "article"
	BannerLinkTypeExternal BannerLinkType = "external"
	BannerLinkTypeNone     BannerLinkType = "none"
)

type Banner struct {
	ID        uint64         `gorm:"primaryKey;autoIncrement" json:"id"`
	Title     string         `gorm:"size:100;default:''" json:"title"`
	ImageURL  string         `gorm:"size:512;not null" json:"image_url"`
	LinkType  BannerLinkType `gorm:"type:enum('property','article','external','none');not null;default:'none'" json:"link_type"`
	LinkValue string         `gorm:"size:500;default:''" json:"link_value"`
	Position  BannerPosition `gorm:"type:enum('home','list');not null;default:'home';index" json:"position"`
	SortOrder int            `gorm:"not null;default:0" json:"sort_order"`
	IsActive  bool           `gorm:"not null;default:true" json:"is_active"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
}

func (Banner) TableName() string { return "banners" }

type Area struct {
	ID        uint64 `gorm:"primaryKey;autoIncrement" json:"id"`
	ParentID  uint64 `gorm:"not null;default:0;index" json:"parent_id"`
	Name      string `gorm:"size:50;not null" json:"name"`
	SortOrder int    `gorm:"not null;default:0" json:"sort_order"`
	IsActive  bool   `gorm:"not null;default:true" json:"is_active"`
}

func (Area) TableName() string { return "areas" }

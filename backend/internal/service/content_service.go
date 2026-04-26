package service

import (
	"fmt"
	"time"

	"fangchan/internal/model"
	"fangchan/internal/repository"
)

type ContentService struct {
	repo *repository.ContentRepo
}

func NewContentService(repo *repository.ContentRepo) *ContentService {
	return &ContentService{repo: repo}
}

// ---- Article ----

type CreateArticleReq struct {
	Title      string `json:"title" binding:"required"`
	Summary    string `json:"summary"`
	Content    string `json:"content"`
	CoverImage string `json:"cover_image"`
	Category   string `json:"category" binding:"required"`
	Author     string `json:"author"`
}

type UpdateArticleReq struct {
	Title      string `json:"title"`
	Summary    string `json:"summary"`
	Content    string `json:"content"`
	CoverImage string `json:"cover_image"`
	Category   string `json:"category"`
	Author     string `json:"author"`
	Status     string `json:"status"`
}

func (s *ContentService) CreateArticle(req *CreateArticleReq, createdBy uint64) (*model.Article, error) {
	a := &model.Article{
		Title:      req.Title,
		Summary:    req.Summary,
		Content:    req.Content,
		CoverImage: req.CoverImage,
		Category:   model.ArticleCategory(req.Category),
		Author:     req.Author,
		Status:     model.ArticleStatusDraft,
		CreatedBy:  createdBy,
	}
	return a, s.repo.CreateArticle(a)
}

func (s *ContentService) UpdateArticle(id uint64, req *UpdateArticleReq) (*model.Article, error) {
	a, err := s.repo.FindArticleByID(id)
	if err != nil || a == nil {
		return nil, fmt.Errorf("文章不存在")
	}
	if req.Title != "" {
		a.Title = req.Title
	}
	if req.Summary != "" {
		a.Summary = req.Summary
	}
	if req.Content != "" {
		a.Content = req.Content
	}
	if req.CoverImage != "" {
		a.CoverImage = req.CoverImage
	}
	if req.Category != "" {
		a.Category = model.ArticleCategory(req.Category)
	}
	if req.Author != "" {
		a.Author = req.Author
	}
	if req.Status != "" {
		a.Status = model.ArticleStatus(req.Status)
		if req.Status == string(model.ArticleStatusPublished) && a.PublishedAt == nil {
			now := time.Now()
			a.PublishedAt = &now
		}
	}
	return a, s.repo.UpdateArticle(a)
}

func (s *ContentService) DeleteArticle(id uint64) error {
	return s.repo.DeleteArticle(id)
}

func (s *ContentService) GetArticle(id uint64) (*model.Article, error) {
	a, err := s.repo.FindArticleByID(id)
	if err != nil {
		return nil, err
	}
	if a != nil {
		go s.repo.IncrArticleView(id)
	}
	return a, nil
}

func (s *ContentService) ListArticles(page, limit int, f repository.ArticleFilter) ([]model.Article, int64, error) {
	return s.repo.ListArticles(page, limit, f)
}

// ---- Banner ----

type SaveBannerReq struct {
	Title     string `json:"title"`
	ImageURL  string `json:"image_url" binding:"required"`
	LinkType  string `json:"link_type"`
	LinkValue string `json:"link_value"`
	Position  string `json:"position"`
	SortOrder int    `json:"sort_order"`
	IsActive  *bool  `json:"is_active"`
}

func (s *ContentService) CreateBanner(req *SaveBannerReq) (*model.Banner, error) {
	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}
	b := &model.Banner{
		Title:     req.Title,
		ImageURL:  req.ImageURL,
		LinkType:  model.BannerLinkType(req.LinkType),
		LinkValue: req.LinkValue,
		Position:  model.BannerPosition(req.Position),
		SortOrder: req.SortOrder,
		IsActive:  isActive,
	}
	if b.Position == "" {
		b.Position = model.BannerPositionHome
	}
	if b.LinkType == "" {
		b.LinkType = model.BannerLinkTypeNone
	}
	return b, s.repo.CreateBanner(b)
}

func (s *ContentService) UpdateBanner(id uint64, req *SaveBannerReq) (*model.Banner, error) {
	b, err := s.repo.FindBannerByID(id)
	if err != nil || b == nil {
		return nil, fmt.Errorf("Banner 不存在")
	}
	if req.Title != "" {
		b.Title = req.Title
	}
	if req.ImageURL != "" {
		b.ImageURL = req.ImageURL
	}
	if req.LinkType != "" {
		b.LinkType = model.BannerLinkType(req.LinkType)
	}
	if req.LinkValue != "" {
		b.LinkValue = req.LinkValue
	}
	if req.Position != "" {
		b.Position = model.BannerPosition(req.Position)
	}
	b.SortOrder = req.SortOrder
	if req.IsActive != nil {
		b.IsActive = *req.IsActive
	}
	return b, s.repo.UpdateBanner(b)
}

func (s *ContentService) DeleteBanner(id uint64) error {
	return s.repo.DeleteBanner(id)
}

func (s *ContentService) ListBanners(position string, onlyActive bool) ([]model.Banner, error) {
	return s.repo.ListBanners(position, onlyActive)
}

// ---- Area ----

type SaveAreaReq struct {
	ParentID  uint64 `json:"parent_id"`
	Name      string `json:"name" binding:"required"`
	SortOrder int    `json:"sort_order"`
}

func (s *ContentService) CreateArea(req *SaveAreaReq) (*model.Area, error) {
	a := &model.Area{
		ParentID:  req.ParentID,
		Name:      req.Name,
		SortOrder: req.SortOrder,
		IsActive:  true,
	}
	return a, s.repo.CreateArea(a)
}

func (s *ContentService) UpdateArea(id uint64, req *SaveAreaReq) (*model.Area, error) {
	a, err := s.repo.FindAreaByID(id)
	if err != nil || a == nil {
		return nil, fmt.Errorf("区域不存在")
	}
	if req.Name != "" {
		a.Name = req.Name
	}
	a.SortOrder = req.SortOrder
	return a, s.repo.UpdateArea(a)
}

func (s *ContentService) DeleteArea(id uint64) error {
	return s.repo.DeleteArea(id)
}

func (s *ContentService) ListAreas() ([]model.Area, error) {
	return s.repo.ListAreas()
}

// ListAreaTree 返回嵌套树形结构
type AreaNode struct {
	model.Area
	Children []AreaNode `json:"children,omitempty"`
}

func (s *ContentService) ListAreaTree() ([]AreaNode, error) {
	areas, err := s.repo.ListAreas()
	if err != nil {
		return nil, err
	}
	nodeMap := make(map[uint64]*AreaNode)
	for i := range areas {
		n := &AreaNode{Area: areas[i]}
		nodeMap[areas[i].ID] = n
	}
	var roots []AreaNode
	for _, a := range areas {
		if a.ParentID == 0 {
			roots = append(roots, *nodeMap[a.ID])
		} else if parent, ok := nodeMap[a.ParentID]; ok {
			parent.Children = append(parent.Children, *nodeMap[a.ID])
		}
	}
	return roots, nil
}

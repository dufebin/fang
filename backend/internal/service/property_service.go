package service

import (
	"fmt"

	"fangchan/internal/model"
	"fangchan/internal/repository"
	"fangchan/pkg/storage"
	"mime/multipart"
)

type PropertyService struct {
	propertyRepo *repository.PropertyRepo
	agentRepo    *repository.AgentRepo
	store        storage.Storage
}

func NewPropertyService(
	propertyRepo *repository.PropertyRepo,
	agentRepo *repository.AgentRepo,
	store storage.Storage,
) *PropertyService {
	return &PropertyService{
		propertyRepo: propertyRepo,
		agentRepo:    agentRepo,
		store:        store,
	}
}

type CreatePropertyReq struct {
	Title        string   `form:"title" json:"title" binding:"required"`
	PropertyType string   `form:"property_type" json:"property_type" binding:"required"`
	Province     string   `form:"province" json:"province"`
	City         string   `form:"city" json:"city" binding:"required"`
	District     string   `form:"district" json:"district" binding:"required"`
	Address      string   `form:"address" json:"address"`
	TotalPrice   *float64 `form:"total_price" json:"total_price"`
	UnitPrice    *float64 `form:"unit_price" json:"unit_price"`
	MonthlyRent  *float64 `form:"monthly_rent" json:"monthly_rent"`
	Area         float64  `form:"area" json:"area" binding:"required,gt=0"`
	Bedrooms     uint8    `form:"bedrooms" json:"bedrooms"`
	LivingRooms  uint8    `form:"living_rooms" json:"living_rooms"`
	Bathrooms    uint8    `form:"bathrooms" json:"bathrooms"`
	Floor        *int16   `form:"floor" json:"floor"`
	TotalFloors  *int16   `form:"total_floors" json:"total_floors"`
	Decoration   string   `form:"decoration" json:"decoration"`
	Direction    string   `form:"direction" json:"direction"`
	Description  string   `form:"description" json:"description"`
	Commission   *float64 `form:"commission" json:"commission"`
}

type PropertyDetailResp struct {
	*model.Property
	Agent *AgentCard `json:"agent,omitempty"`
}

type AgentCard struct {
	ID              uint64   `json:"id"`
	Name            string   `json:"name"`
	Phone           string   `json:"phone"`
	WechatID        string   `json:"wechat_id"`
	WechatQRURL     string   `json:"wechat_qr_url"`
	AvatarURL       string   `json:"avatar_url"`
	Bio             string   `json:"bio"`
	AgentCode       string   `json:"agent_code"`
	ClaimCommission *float64 `json:"claim_commission"`
}

// GetDetailWithAgent 获取房源详情（含销售员信息）
// 有 agentCode：显示该认领人名片 + 其 claim_commission
// 无 agentCode：显示录入人（owner_agent）名片 + 房源原始 commission
func (s *PropertyService) GetDetailWithAgent(propertyID uint64, agentCode string) (*PropertyDetailResp, error) {
	property, err := s.propertyRepo.FindByID(propertyID)
	if err != nil {
		return nil, err
	}
	if property == nil {
		return nil, nil
	}

	resp := &PropertyDetailResp{Property: property}

	var displayAgent *model.Agent

	if agentCode != "" {
		displayAgent, err = s.agentRepo.FindByCode(agentCode)
		if err != nil {
			return nil, err
		}
		if displayAgent != nil && displayAgent.Status != model.AgentStatusActive {
			displayAgent = nil
		}
	}

	if displayAgent == nil && property.OwnerAgentID != nil {
		displayAgent, _ = s.agentRepo.FindByID(*property.OwnerAgentID)
	}

	if displayAgent != nil {
		card := &AgentCard{
			ID:          displayAgent.ID,
			Name:        displayAgent.Name,
			Phone:       displayAgent.Phone,
			WechatID:    displayAgent.WechatID,
			WechatQRURL: displayAgent.WechatQRURL,
			AvatarURL:   displayAgent.AvatarURL,
			Bio:         displayAgent.Bio,
			AgentCode:   displayAgent.AgentCode,
		}
		if agentCode != "" {
			card.ClaimCommission, _ = s.agentRepo.GetClaimCommission(displayAgent.ID, propertyID)
		}
		resp.Agent = card
	}

	return resp, nil
}

// RecordView 记录浏览
func (s *PropertyService) RecordView(propertyID uint64, agentCode, viewerOpenID, ip string) {
	var agentID *uint64
	if agentCode != "" {
		agent, _ := s.agentRepo.FindByCode(agentCode)
		if agent != nil {
			id := agent.ID
			agentID = &id
		}
	}
	_ = s.propertyRepo.RecordView(&model.PropertyView{
		PropertyID:   propertyID,
		AgentID:      agentID,
		ViewerOpenID: viewerOpenID,
		IP:           ip,
	})
	_ = s.propertyRepo.IncrViewCount(propertyID)
}

// Create 创建房源
func (s *PropertyService) Create(req *CreatePropertyReq, createdBy uint64) (*model.Property, error) {
	property := &model.Property{
		Title:        req.Title,
		PropertyType: model.PropertyType(req.PropertyType),
		Province:     req.Province,
		City:         req.City,
		District:     req.District,
		Address:      req.Address,
		TotalPrice:   req.TotalPrice,
		UnitPrice:    req.UnitPrice,
		MonthlyRent:  req.MonthlyRent,
		Area:         req.Area,
		Bedrooms:     req.Bedrooms,
		LivingRooms:  req.LivingRooms,
		Bathrooms:    req.Bathrooms,
		Floor:        req.Floor,
		TotalFloors:  req.TotalFloors,
		Direction:    req.Direction,
		Description:  req.Description,
		Commission:   req.Commission,
		Status:       model.PropertyStatusAvailable,
		CreatedBy:    createdBy,
	}
	if req.Decoration != "" {
		property.Decoration = model.Decoration(req.Decoration)
	}
	return property, s.propertyRepo.Create(property)
}

// UploadImage 上传房源图片
func (s *PropertyService) UploadImage(propertyID uint64, file multipart.File, header *multipart.FileHeader, sortOrder uint8) (*model.PropertyImage, error) {
	url, err := s.store.Save(file, header)
	if err != nil {
		return nil, fmt.Errorf("保存图片失败: %w", err)
	}

	img := &model.PropertyImage{
		PropertyID: propertyID,
		URL:        url,
		SortOrder:  sortOrder,
	}
	if err := s.propertyRepo.AddImages([]model.PropertyImage{*img}); err != nil {
		return nil, err
	}

	// 上传首张图时自动设置封面
	if sortOrder == 0 {
		if property, err := s.propertyRepo.FindByID(propertyID); err == nil && property != nil && property.CoverImage == "" {
			property.CoverImage = url
			_ = s.propertyRepo.Update(property)
		}
	}

	return img, nil
}

// UploadVideo 上传房源视频并更新 video_url
func (s *PropertyService) UploadVideo(propertyID uint64, file multipart.File, header *multipart.FileHeader) (string, error) {
	url, err := s.store.SaveVideo(file, header)
	if err != nil {
		return "", fmt.Errorf("保存视频失败: %w", err)
	}
	property, err := s.propertyRepo.FindByID(propertyID)
	if err != nil || property == nil {
		return "", fmt.Errorf("房源不存在")
	}
	property.VideoURL = url
	if err := s.propertyRepo.Update(property); err != nil {
		return "", err
	}
	return url, nil
}

// GetByID 获取房源详情（含图片）
func (s *PropertyService) GetByID(id uint64) (*model.Property, error) {
	return s.propertyRepo.FindByID(id)
}

// DeleteImage 删除房源图片
func (s *PropertyService) DeleteImage(propertyID, imageID uint64) error {
	return s.propertyRepo.DeleteImages(propertyID, []uint64{imageID})
}

// List 房源列表
func (s *PropertyService) List(page, limit int, filter repository.PropertyFilter) ([]model.Property, int64, error) {
	return s.propertyRepo.List(page, limit, filter)
}

// GetAgentProperties 获取销售员认领的房源
func (s *PropertyService) GetAgentProperties(agentID uint64, page, limit int) ([]model.Property, int64, error) {
	ids, err := s.agentRepo.GetClaimedPropertyIDs(agentID)
	if err != nil {
		return nil, 0, err
	}
	return s.propertyRepo.ListByIDs(ids, page, limit)
}

// DeleteProperty 删除房源（仅 owner_agent 或 admin）
func (s *PropertyService) DeleteProperty(id, userID uint64, isAdmin bool) error {
	property, err := s.propertyRepo.FindByID(id)
	if err != nil || property == nil {
		return fmt.Errorf("房源不存在")
	}
	if !isAdmin {
		agent, err := s.agentRepo.FindByUserID(userID)
		if err != nil || agent == nil {
			return fmt.Errorf("无权限")
		}
		if property.OwnerAgentID == nil || *property.OwnerAgentID != agent.ID {
			return fmt.Errorf("仅房源负责人可删除")
		}
	}
	return s.propertyRepo.Delete(id)
}

// UpdateStatus 更新状态
func (s *PropertyService) UpdateStatus(id uint64, status string) error {
	property, err := s.propertyRepo.FindByID(id)
	if err != nil || property == nil {
		return fmt.Errorf("房源不存在")
	}
	property.Status = model.PropertyStatus(status)
	return s.propertyRepo.Update(property)
}

type UpdatePropertyReq struct {
	Title         string   `json:"title"`
	PropertyType  string   `json:"property_type"`
	Province      string   `json:"province"`
	City          string   `json:"city"`
	District      string   `json:"district"`
	Address       string   `json:"address"`
	TotalPrice    *float64 `json:"total_price"`
	UnitPrice     *float64 `json:"unit_price"`
	MonthlyRent   *float64 `json:"monthly_rent"`
	Area          *float64 `json:"area"`
	Bedrooms      *uint8   `json:"bedrooms"`
	LivingRooms   *uint8   `json:"living_rooms"`
	Bathrooms     *uint8   `json:"bathrooms"`
	Floor         *int16   `json:"floor"`
	TotalFloors   *int16   `json:"total_floors"`
	Decoration    string   `json:"decoration"`
	Direction     string   `json:"direction"`
	Description   string   `json:"description"`
	CoverImage    string   `json:"cover_image"`
	VideoURL      string   `json:"video_url"`
	ClearVideo    bool     `json:"clear_video"`
	VRURL         string   `json:"vr_url"`
	Tags          string   `json:"tags"`
	Latitude      *float64 `json:"latitude"`
	Longitude     *float64 `json:"longitude"`
	CommunityName string   `json:"community_name"`
	BuildingAge   *int16   `json:"building_age"`
	Parking       *int16   `json:"parking"`
	HasElevator   *bool    `json:"has_elevator"`
	Commission    *float64 `json:"commission"`
}

// UpdateProperty 更新房源（仅 owner_agent 或 admin）
func (s *PropertyService) UpdateProperty(id, userID uint64, isAdmin bool, req *UpdatePropertyReq) (*model.Property, error) {
	property, err := s.propertyRepo.FindByID(id)
	if err != nil || property == nil {
		return nil, fmt.Errorf("房源不存在")
	}

	if !isAdmin {
		agent, err := s.agentRepo.FindByUserID(userID)
		if err != nil || agent == nil {
			return nil, fmt.Errorf("无权限")
		}
		if property.OwnerAgentID == nil || *property.OwnerAgentID != agent.ID {
			return nil, fmt.Errorf("仅房源负责人可编辑")
		}
	}

	if req.Title != "" {
		property.Title = req.Title
	}
	if req.PropertyType != "" {
		property.PropertyType = model.PropertyType(req.PropertyType)
	}
	if req.Province != "" {
		property.Province = req.Province
	}
	if req.City != "" {
		property.City = req.City
	}
	if req.District != "" {
		property.District = req.District
	}
	if req.Address != "" {
		property.Address = req.Address
	}
	if req.TotalPrice != nil {
		property.TotalPrice = req.TotalPrice
	}
	if req.UnitPrice != nil {
		property.UnitPrice = req.UnitPrice
	}
	if req.MonthlyRent != nil {
		property.MonthlyRent = req.MonthlyRent
	}
	if req.Area != nil {
		property.Area = *req.Area
	}
	if req.Bedrooms != nil {
		property.Bedrooms = *req.Bedrooms
	}
	if req.LivingRooms != nil {
		property.LivingRooms = *req.LivingRooms
	}
	if req.Bathrooms != nil {
		property.Bathrooms = *req.Bathrooms
	}
	if req.Floor != nil {
		property.Floor = req.Floor
	}
	if req.TotalFloors != nil {
		property.TotalFloors = req.TotalFloors
	}
	if req.Decoration != "" {
		property.Decoration = model.Decoration(req.Decoration)
	}
	if req.Direction != "" {
		property.Direction = req.Direction
	}
	if req.Description != "" {
		property.Description = req.Description
	}
	if req.CoverImage != "" {
		property.CoverImage = req.CoverImage
	}
	if req.ClearVideo {
		property.VideoURL = ""
	} else if req.VideoURL != "" {
		property.VideoURL = req.VideoURL
	}
	if req.VRURL != "" {
		property.VRURL = req.VRURL
	}
	if req.Tags != "" {
		property.Tags = req.Tags
	}
	if req.Latitude != nil {
		property.Latitude = req.Latitude
	}
	if req.Longitude != nil {
		property.Longitude = req.Longitude
	}
	if req.CommunityName != "" {
		property.CommunityName = req.CommunityName
	}
	if req.BuildingAge != nil {
		property.BuildingAge = req.BuildingAge
	}
	if req.Parking != nil {
		property.Parking = req.Parking
	}
	if req.HasElevator != nil {
		property.HasElevator = *req.HasElevator
	}
	if req.Commission != nil {
		property.Commission = req.Commission
	}

	return property, s.propertyRepo.Update(property)
}

// CreateWithOwner 创建房源并绑定录入人为 owner_agent（会自动创建经纪人档案）
func (s *PropertyService) CreateWithOwner(req *CreatePropertyReq, createdBy uint64, agent *model.Agent) (*model.Property, error) {
	property, err := s.Create(req, createdBy)
	if err != nil {
		return nil, err
	}
	if agent != nil {
		property.OwnerAgentID = &agent.ID
		_ = s.propertyRepo.Update(property)
	}
	return property, nil
}

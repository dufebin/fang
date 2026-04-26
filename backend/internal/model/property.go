package model

import "time"

type PropertyType string
type PropertyStatus string
type Decoration string

const (
	PropertyTypeNew      PropertyType = "新房"
	PropertyTypeSecond   PropertyType = "二手房"
	PropertyTypeRent     PropertyType = "租房"
	PropertyTypeCommerce PropertyType = "商铺"

	PropertyStatusAvailable PropertyStatus = "available"
	PropertyStatusSold      PropertyStatus = "sold"
	PropertyStatusRented    PropertyStatus = "rented"
	PropertyStatusOffline   PropertyStatus = "offline"

	DecorationBare   Decoration = "毛坯"
	DecorationSimple Decoration = "简装"
	DecorationFine   Decoration = "精装"
	DecorationLuxury Decoration = "豪华装修"
)

type Property struct {
	ID           uint64         `gorm:"primaryKey;autoIncrement" json:"id"`
	Title        string         `gorm:"size:100;not null" json:"title"`
	PropertyType PropertyType   `gorm:"type:enum('新房','二手房','租房','商铺');not null;default:'二手房'" json:"property_type"`
	City         string         `gorm:"size:30;not null;default:''" json:"city"`
	District     string         `gorm:"size:50;not null;default:'';index" json:"district"`
	Address      string         `gorm:"size:200;not null;default:''" json:"address"`
	TotalPrice   *float64       `gorm:"type:decimal(12,2)" json:"total_price"`
	UnitPrice    *float64       `gorm:"type:decimal(10,2)" json:"unit_price"`
	MonthlyRent  *float64       `gorm:"type:decimal(10,2)" json:"monthly_rent"`
	Area         float64        `gorm:"type:decimal(8,2);not null;default:0" json:"area"`
	Bedrooms     uint8          `gorm:"not null;default:0" json:"bedrooms"`
	LivingRooms  uint8          `gorm:"not null;default:0" json:"living_rooms"`
	Bathrooms    uint8          `gorm:"not null;default:0" json:"bathrooms"`
	Floor        *int16         `json:"floor"`
	TotalFloors  *int16         `json:"total_floors"`
	Decoration   Decoration     `gorm:"type:enum('毛坯','简装','精装','豪华装修');default:'精装'" json:"decoration"`
	Direction    string         `gorm:"size:20;default:''" json:"direction"`
	Description  string         `gorm:"type:text" json:"description"`
	CoverImage    string         `gorm:"size:512;default:''" json:"cover_image"`
	Status        PropertyStatus `gorm:"type:enum('available','sold','rented','offline');not null;default:'available';index" json:"status"`
	ViewCount     uint32         `gorm:"not null;default:0" json:"view_count"`
	CreatedBy     uint64         `gorm:"not null;index" json:"created_by"`
	OwnerAgentID  *uint64        `gorm:"index" json:"owner_agent_id"`
	VideoURL      string         `gorm:"size:512;default:''" json:"video_url"`
	VRURL         string         `gorm:"size:512;default:''" json:"vr_url"`
	Tags          string         `gorm:"size:500;default:''" json:"tags"`
	Latitude      *float64       `gorm:"type:decimal(10,7)" json:"latitude"`
	Longitude     *float64       `gorm:"type:decimal(10,7)" json:"longitude"`
	CommunityName string         `gorm:"size:100;default:''" json:"community_name"`
	BuildingAge   *int16         `json:"building_age"`
	Parking       *int16         `json:"parking"`
	HasElevator   bool           `gorm:"not null;default:false" json:"has_elevator"`
	IsVerified    bool           `gorm:"not null;default:false" json:"is_verified"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`

	Images []PropertyImage `gorm:"foreignKey:PropertyID" json:"images,omitempty"`
}

func (Property) TableName() string { return "properties" }

type PropertyImage struct {
	ID         uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	PropertyID uint64    `gorm:"not null;index" json:"property_id"`
	URL        string    `gorm:"size:512;not null" json:"url"`
	SortOrder  uint8     `gorm:"not null;default:0" json:"sort_order"`
	CreatedAt  time.Time `json:"created_at"`
}

func (PropertyImage) TableName() string { return "property_images" }

type PropertyView struct {
	ID          uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	PropertyID  uint64    `gorm:"not null;index" json:"property_id"`
	AgentID     *uint64   `gorm:"index" json:"agent_id"`
	ViewerOpenID string   `gorm:"size:64;default:''" json:"viewer_openid"`
	IP          string    `gorm:"size:50;default:''" json:"ip"`
	ViewedAt    time.Time `gorm:"autoCreateTime;index" json:"viewed_at"`
}

func (PropertyView) TableName() string { return "property_views" }

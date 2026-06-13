package repository

import (
	"time"

	"gorm.io/gorm"
)

type StatsRepo struct {
	db *gorm.DB
}

func NewStatsRepo(db *gorm.DB) *StatsRepo {
	return &StatsRepo{db: db}
}

type OverviewStats struct {
	TotalProperties     int64 `json:"total_properties"`
	AvailableProperties int64 `json:"available_properties"`
	TotalAgents         int64 `json:"total_agents"`
	ActiveAgents        int64 `json:"active_agents"`
	TotalUsers          int64 `json:"total_users"`
	TotalAppointments   int64 `json:"total_appointments"`
	TodayViews          int64 `json:"today_views"`
}

func (r *StatsRepo) Overview() (*OverviewStats, error) {
	s := &OverviewStats{}
	r.db.Table("properties").Count(&s.TotalProperties)
	r.db.Table("properties").Where("status = 'available'").Count(&s.AvailableProperties)
	r.db.Table("agents").Count(&s.TotalAgents)
	r.db.Table("agents").Where("status = 'active'").Count(&s.ActiveAgents)
	r.db.Table("users").Count(&s.TotalUsers)
	r.db.Table("appointments").Count(&s.TotalAppointments)

	today := time.Now().Format("2006-01-02")
	r.db.Table("browse_histories").Where("DATE(viewed_at) = ?", today).Count(&s.TodayViews)
	return s, nil
}

type PropertyTypeStat struct {
	PropertyType string `json:"property_type"`
	Count        int64  `json:"count"`
}

func (r *StatsRepo) PropertyTypeDistribution() ([]PropertyTypeStat, error) {
	var result []PropertyTypeStat
	err := r.db.Table("properties").
		Select("property_type, count(*) as count").
		Where("status != 'offline'").
		Group("property_type").
		Scan(&result).Error
	if result == nil {
	result = []PropertyTypeStat{}
}
return result, err
}

type AgentRankItem struct {
	AgentID   uint64 `json:"agent_id"`
	AgentName string `json:"agent_name"`
	AgentCode string `json:"agent_code"`
	Views     int64  `json:"views"`
	Claims    int64  `json:"claims"`
	Appointments int64 `json:"appointments"`
}

func (r *StatsRepo) AgentRanking(limit int) ([]AgentRankItem, error) {
	var result []AgentRankItem
	sql := `
		SELECT a.id AS agent_id, a.name AS agent_name, a.agent_code,
			COALESCE(v.views, 0)        AS views,
			COALESCE(c.claims, 0)       AS claims,
			COALESCE(ap.appointments, 0) AS appointments
		FROM agents a
		LEFT JOIN (SELECT agent_code, COUNT(*) AS views FROM browse_histories GROUP BY agent_code) v
			ON v.agent_code = a.agent_code
		LEFT JOIN (SELECT agent_id, COUNT(*) AS claims FROM agent_properties GROUP BY agent_id) c
			ON c.agent_id = a.id
		LEFT JOIN (SELECT agent_id, COUNT(*) AS appointments FROM appointments GROUP BY agent_id) ap
			ON ap.agent_id = a.id
		WHERE a.status = 'active'
		ORDER BY views DESC
		LIMIT ?`
	err := r.db.Raw(sql, limit).Scan(&result).Error
	if result == nil {
		result = []AgentRankItem{}
	}
	return result, err
}

type ViewTrend struct {
	Date  string `json:"date"`
	Count int64  `json:"count"`
}

func (r *StatsRepo) ViewTrend(days int) ([]ViewTrend, error) {
	var result []ViewTrend
	err := r.db.Table("browse_histories").
		Select("DATE(viewed_at) as date, COUNT(*) as count").
		Where("viewed_at >= ?", time.Now().AddDate(0, 0, -days)).
		Group("DATE(viewed_at)").
		Order("date ASC").
		Scan(&result).Error
	if result == nil {
	result = []ViewTrend{}
}
return result, err
}

type FunnelStage struct {
	Stage string `json:"stage"`
	Count int64  `json:"count"`
}

func (r *StatsRepo) ConversionFunnel() ([]FunnelStage, error) {
	var views, favorites, appointments int64
	r.db.Table("browse_histories").Count(&views)
	r.db.Table("favorites").Count(&favorites)
	r.db.Table("appointments").Count(&appointments)
	return []FunnelStage{
		{Stage: "浏览", Count: views},
		{Stage: "收藏", Count: favorites},
		{Stage: "预约", Count: appointments},
	}, nil
}

type AgentStats struct {
	PropertyCount    int64 `json:"property_count"`
	TotalViews       int64 `json:"total_views"`
	AppointmentCount int64 `json:"appointment_count"`
	FavoriteCount    int64 `json:"favorite_count"`

	// 兼容旧前端字段
	Views        int64 `json:"views"`
	Claims       int64 `json:"claims"`
	Appointments int64 `json:"appointments"`
}

func (r *StatsRepo) AgentStats(agentID uint64) (*AgentStats, error) {
	s := &AgentStats{}

	relatedPropertySubQuery := r.db.Table("properties").
		Select("id").
		Where("owner_agent_id = ?", agentID).
		Or("id IN (?)", r.db.Table("agent_properties").Select("property_id").Where("agent_id = ?", agentID))

	if err := r.db.Table("properties").Where("id IN (?)", relatedPropertySubQuery).Count(&s.PropertyCount).Error; err != nil {
		return nil, err
	}
	if err := r.db.Table("properties").Where("id IN (?)", relatedPropertySubQuery).
		Select("COALESCE(SUM(view_count), 0)").Scan(&s.TotalViews).Error; err != nil {
		return nil, err
	}
	if err := r.db.Table("favorites").Where("property_id IN (?)", relatedPropertySubQuery).Count(&s.FavoriteCount).Error; err != nil {
		return nil, err
	}
	if err := r.db.Table("appointments").Where("agent_id = ?", agentID).Count(&s.AppointmentCount).Error; err != nil {
		return nil, err
	}
	if err := r.db.Table("agent_properties").Where("agent_id = ?", agentID).Count(&s.Claims).Error; err != nil {
		return nil, err
	}

	// 兼容旧前端字段
	s.Views = s.TotalViews
	s.Appointments = s.AppointmentCount

	return s, nil
}

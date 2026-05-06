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
	Views        int64 `json:"views"`
	Claims       int64 `json:"claims"`
	Appointments int64 `json:"appointments"`
}

func (r *StatsRepo) AgentStats(agentID uint64) (*AgentStats, error) {
	s := &AgentStats{}
	r.db.Table("browse_histories").Where("agent_code IN (SELECT agent_code FROM agents WHERE id = ?)", agentID).Count(&s.Views)
	r.db.Table("agent_properties").Where("agent_id = ?", agentID).Count(&s.Claims)
	r.db.Table("appointments").Where("agent_id = ?", agentID).Count(&s.Appointments)
	return s, nil
}

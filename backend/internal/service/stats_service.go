package service

import (
	"fangchan/internal/repository"
)

type StatsService struct {
	repo *repository.StatsRepo
}

func NewStatsService(repo *repository.StatsRepo) *StatsService {
	return &StatsService{repo: repo}
}

func (s *StatsService) Overview() (*repository.OverviewStats, error) {
	return s.repo.Overview()
}

func (s *StatsService) PropertyTypeDistribution() ([]repository.PropertyTypeStat, error) {
	return s.repo.PropertyTypeDistribution()
}

func (s *StatsService) AgentRanking(limit int) ([]repository.AgentRankItem, error) {
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	return s.repo.AgentRanking(limit)
}

func (s *StatsService) ViewTrend(days int) ([]repository.ViewTrend, error) {
	if days <= 0 || days > 90 {
		days = 30
	}
	return s.repo.ViewTrend(days)
}

func (s *StatsService) ConversionFunnel() ([]repository.FunnelStage, error) {
	return s.repo.ConversionFunnel()
}

func (s *StatsService) AgentStats(agentID uint64) (*repository.AgentStats, error) {
	return s.repo.AgentStats(agentID)
}

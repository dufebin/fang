package handler

import (
	"log"
	"strconv"

	"fangchan/internal/service"
	"fangchan/pkg/response"

	"github.com/gin-gonic/gin"
)

type StatsHandler struct {
	statsSvc *service.StatsService
}

func NewStatsHandler(statsSvc *service.StatsService) *StatsHandler {
	return &StatsHandler{statsSvc: statsSvc}
}

// Overview GET /admin/stats/overview
func (h *StatsHandler) Overview(c *gin.Context) {
	data, err := h.statsSvc.Overview()
	if err != nil {
		log.Printf("stats Overview error: %v", err)
		response.ServerError(c, err)
		return
	}
	response.Success(c, data)
}

// PropertyTypeDistribution GET /admin/stats/property-types
func (h *StatsHandler) PropertyTypeDistribution(c *gin.Context) {
	data, err := h.statsSvc.PropertyTypeDistribution()
	if err != nil {
		log.Printf("stats PropertyTypeDistribution error: %v", err)
		response.ServerError(c, err)
		return
	}
	response.Success(c, data)
}

// AgentRanking GET /admin/stats/agent-ranking
func (h *StatsHandler) AgentRanking(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	data, err := h.statsSvc.AgentRanking(limit)
	if err != nil {
		log.Printf("stats AgentRanking error: %v", err)
		response.ServerError(c, err)
		return
	}
	response.Success(c, data)
}

// ViewTrend GET /admin/stats/view-trend
func (h *StatsHandler) ViewTrend(c *gin.Context) {
	days, _ := strconv.Atoi(c.DefaultQuery("days", "30"))
	data, err := h.statsSvc.ViewTrend(days)
	if err != nil {
		log.Printf("stats ViewTrend error: %v", err)
		response.ServerError(c, err)
		return
	}
	response.Success(c, data)
}

// ConversionFunnel GET /admin/stats/funnel
func (h *StatsHandler) ConversionFunnel(c *gin.Context) {
	data, err := h.statsSvc.ConversionFunnel()
	if err != nil {
		log.Printf("stats ConversionFunnel error: %v", err)
		response.ServerError(c, err)
		return
	}
	log.Printf("ConversionFunnel data type: %T, value: %+v", data, data)
	response.Success(c, data)
}

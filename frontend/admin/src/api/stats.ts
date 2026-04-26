import request from './request'

export function getOverview() {
  return request.get('/admin/stats/overview')
}

export function getPropertyTypeDistribution() {
  return request.get('/admin/stats/property-types')
}

export function getAgentRanking(params?: { limit?: number }) {
  return request.get('/admin/stats/agent-ranking', { params })
}

export function getViewTrend(params?: { days?: number }) {
  return request.get('/admin/stats/view-trend', { params })
}

export function getConversionFunnel() {
  return request.get('/admin/stats/funnel')
}

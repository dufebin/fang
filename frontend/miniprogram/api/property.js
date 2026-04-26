const { request } = require('../utils/request')

// 房源列表
function listProperties(params) {
  return request({ url: '/h5/properties', data: params })
}

// 房源详情（含经纪人名片）
function getPropertyDetail(id, agentCode) {
  return request({ url: `/h5/property/${id}`, data: agentCode ? { a: agentCode } : {} })
}

// 附近房源
function getNearbyProperties(lat, lng, radius = 3) {
  return request({ url: '/h5/properties', data: { lat, lng, radius } })
}

// 创建房源（经纪人）
function createProperty(data) {
  return request({ url: '/agent/properties', method: 'POST', data })
}

// 更新房源（owner_agent）
function updateProperty(id, data) {
  return request({ url: `/agent/properties/${id}`, method: 'PUT', data })
}

// 认领房源
function claimProperty(id) {
  return request({ url: `/agent/properties/${id}/claim`, method: 'POST' })
}

// 取消认领
function unclaimProperty(id) {
  return request({ url: `/agent/properties/${id}/claim`, method: 'DELETE' })
}

// 我认领的房源
function getMyProperties(params) {
  return request({ url: '/agent/properties', data: params })
}

// 所有房源（经纪人用于认领）
function getAllProperties(params) {
  return request({ url: '/agent/all-properties', data: params })
}

module.exports = {
  listProperties,
  getPropertyDetail,
  getNearbyProperties,
  createProperty,
  updateProperty,
  claimProperty,
  unclaimProperty,
  getMyProperties,
  getAllProperties,
}

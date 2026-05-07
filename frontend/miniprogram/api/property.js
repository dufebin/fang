const { request } = require('../utils/request')

// 房源列表
function listProperties(params) {
  return request({ url: '/h5/properties', data: params })
}

// 房源详情（含经纪人名片）
function getPropertyDetail(id, agentCode) {
  return request({ url: `/h5/property/${id}`, data: agentCode ? { a: agentCode } : {} })
}

// 附近房源（接受 { latitude, longitude, radius, page_size } 对象）
function getNearbyProperties(params) {
  return request({ url: '/h5/properties', data: params })
}

// 经纪人获取自己的单个房源详情（用于编辑）
function getAgentPropertyDetail(id) {
  return request({ url: `/agent/properties/${id}` })
}

// 经纪人删除自己的房源
function deleteProperty(id) {
  return request({ url: `/agent/properties/${id}`, method: 'DELETE' })
}

// 经纪人删除房源图片
function deletePropertyImage(propertyId, imgId) {
  return request({ url: `/agent/properties/${propertyId}/images/${imgId}`, method: 'DELETE' })
}

// 经纪人更新房源状态
function updatePropertyStatus(id, status) {
  return request({ url: `/agent/properties/${id}/status`, method: 'PUT', data: { status } })
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
  getAgentPropertyDetail,
  createProperty,
  updateProperty,
  deleteProperty,
  deletePropertyImage,
  updatePropertyStatus,
  claimProperty,
  unclaimProperty,
  getMyProperties,
  getAllProperties,
}

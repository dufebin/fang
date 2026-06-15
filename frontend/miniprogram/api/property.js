const { request } = require('../utils/request')

function listProperties(params) {
  return request({ url: '/h5/properties', data: params })
}

function getHotDistricts(params) {
  return request({ url: '/h5/properties/hot-districts', data: params })
}

function getPropertyDetail(id, agentCode) {
  return request({ url: `/h5/property/${id}`, data: agentCode ? { a: agentCode } : {} })
}

function getNearbyProperties(params) {
  return request({ url: '/h5/properties', data: params })
}

function getAgentPropertyDetail(id) {
  return request({ url: `/agent/properties/${id}` })
}

function deleteProperty(id) {
  return request({ url: `/agent/properties/${id}`, method: 'DELETE' })
}

function deletePropertyImage(propertyId, imgId) {
  return request({ url: `/agent/properties/${propertyId}/images/${imgId}`, method: 'DELETE' })
}

function updatePropertyStatus(id, status) {
  return request({ url: `/agent/properties/${id}/status`, method: 'PUT', data: { status } })
}

// 任意登录用户均可录入房源
function createProperty(data) {
  return request({ url: '/user/properties', method: 'POST', data })
}

function updateProperty(id, data) {
  return request({ url: `/agent/properties/${id}`, method: 'PUT', data })
}

// 认领房源（任意登录用户），claimCommission 为认领人对外佣金（可不填）
function claimProperty(id, claimCommission) {
  const data = claimCommission != null ? { claim_commission: claimCommission } : {}
  return request({ url: `/user/properties/${id}/claim`, method: 'POST', data })
}

function unclaimProperty(id) {
  return request({ url: `/user/properties/${id}/claim`, method: 'DELETE' })
}

function getMyProperties(params) {
  return request({ url: '/agent/properties', data: params })
}

function getAllProperties(params) {
  return request({ url: '/agent/all-properties', data: params })
}

module.exports = {
  listProperties,
  getHotDistricts,
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

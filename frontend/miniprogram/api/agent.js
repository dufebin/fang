const { request, upload } = require('../utils/request')

// 经纪人主页
function getAgentHome(agentCode, params) {
  return request({ url: `/h5/agent/${agentCode}`, data: params })
}

// 我的经纪人资料
function getProfile() {
  return request({ url: '/agent/profile' })
}

// 更新资料
function updateProfile(data) {
  return request({ url: '/agent/profile', method: 'PUT', data })
}

// 上传头像
function uploadAvatar(filePath) {
  return upload({ url: '/agent/profile/avatar', filePath, name: 'avatar' })
}

// 我的统计数据
function getStats() {
  return request({ url: '/agent/stats' })
}

// 上传房源图片
function uploadPropertyImage(propertyId, filePath, sortOrder = 0) {
  return upload({
    url: `/agent/properties/${propertyId}/images`,
    filePath,
    name: 'image',
    formData: { sort_order: String(sortOrder) },
  })
}

module.exports = {
  getAgentHome,
  getProfile,
  updateProfile,
  uploadAvatar,
  getStats,
  uploadPropertyImage,
}

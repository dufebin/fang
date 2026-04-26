const { request } = require('../utils/request')

// 小程序登录
function mpLogin(code, nickname, avatar) {
  return request({
    url: '/miniprogram/login',
    method: 'POST',
    data: { code, nickname, avatar },
  })
}

// 更新用户资料
function updateProfile(data) {
  return request({ url: '/miniprogram/profile', method: 'PUT', data })
}

// 获取当前用户
function getMe() {
  return request({ url: '/auth/me' })
}

// 收藏 / 取消收藏
function toggleFavorite(propertyId) {
  return request({ url: `/user/favorites/${propertyId}`, method: 'POST' })
}

// 收藏列表
function listFavorites(params) {
  return request({ url: '/user/favorites', data: params })
}

// 浏览历史
function listHistory(params) {
  return request({ url: '/user/history', data: params })
}

// 通知列表
function listNotifications(params) {
  return request({ url: '/user/notifications', data: params })
}

// 标记通知已读
function markRead(id) {
  return request({ url: `/user/notifications/${id}/read`, method: 'PUT' })
}

// 全部已读
function markAllRead() {
  return request({ url: '/user/notifications/read-all', method: 'PUT' })
}

// 提交入驻申请
function submitAgentApply(data) {
  return request({ url: '/user/agent-apply', method: 'POST', data })
}

// 我的入驻申请
function getMyApply() {
  return request({ url: '/user/agent-apply' })
}

module.exports = {
  mpLogin,
  updateProfile,
  getMe,
  toggleFavorite,
  listFavorites,
  listHistory,
  listNotifications,
  markRead,
  markAllRead,
  submitAgentApply,
  getMyApply,
}

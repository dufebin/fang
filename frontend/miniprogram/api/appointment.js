const { request } = require('../utils/request')

// 提交预约
function createAppointment(data) {
  return request({ url: '/user/appointments', method: 'POST', data })
}

// 我的预约列表
function listMyAppointments(params) {
  return request({ url: '/user/appointments', data: params })
}

// 取消预约
function cancelAppointment(id) {
  return request({ url: `/user/appointments/${id}/cancel`, method: 'PUT' })
}

// 经纪人：我的预约单
function listAgentAppointments(params) {
  return request({ url: '/agent/appointments', data: params })
}

// 经纪人：更新预约状态
function updateAppointmentStatus(id, status) {
  return request({ url: `/agent/appointments/${id}/status`, method: 'PUT', data: { status } })
}

module.exports = {
  createAppointment,
  listMyAppointments,
  cancelAppointment,
  listAgentAppointments,
  updateAppointmentStatus,
}

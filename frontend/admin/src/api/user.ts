import request from './request'

export interface User {
  id: number
  nickname: string
  avatar?: string
  phone?: string
  open_id: string
  role: 'user' | 'agent' | 'admin'
  created_at: string
}

export function getUsers(params: { page?: number; limit?: number; keyword?: string; role?: string }) {
  return request.get('/admin/users', { params })
}

export function broadcastNotification(data: { title: string; content: string }) {
  return request.post('/admin/notifications/broadcast', data)
}

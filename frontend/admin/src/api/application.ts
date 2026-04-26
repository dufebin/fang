import request from './request'

export interface AgentApplication {
  id: number
  user_id: number
  name: string
  phone: string
  bio?: string
  years?: number
  status: 'pending' | 'approved' | 'rejected'
  reject_reason?: string
  user?: { nickname: string; avatar: string }
  created_at: string
}

export function getApplications(params: { page?: number; limit?: number; status?: string }) {
  return request.get('/admin/applications', { params })
}

export function approveApplication(id: number) {
  return request.put(`/admin/applications/${id}/review`, { action: 'approve' })
}

export function rejectApplication(id: number, reason: string) {
  return request.put(`/admin/applications/${id}/review`, { action: 'reject', reason })
}

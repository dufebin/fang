import request from './request'

export interface Appointment {
  id: number
  property_id: number
  user_id: number
  agent_id?: number
  scheduled_at: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  note?: string
  property?: { title: string }
  user?: { nickname: string; phone: string }
  agent?: { name: string }
  created_at: string
}

export function getAppointments(params: {
  page?: number
  limit?: number
  status?: string
  keyword?: string
}) {
  return request.get('/admin/appointments', { params })
}

export function updateAppointmentStatus(id: number, status: string) {
  return request.put(`/admin/appointments/${id}/status`, { status })
}

import request from './request'

export interface Agent {
  id: number
  user_id: number
  name: string
  phone: string
  wechat_id: string
  wechat_qr_url: string
  avatar_url: string
  bio: string
  agent_code: string
  status: string
  created_at: string
}

export interface PageResult<T> {
  data: {
    list: T[]
    total: number
    page: number
    limit: number
  }
}

export const getAgents = (params?: { page?: number; limit?: number; status?: string }) =>
  request.get<unknown, PageResult<Agent>>('/admin/agents', { params })

export const createAgent = (data: { user_id: number; name: string; phone: string; wechat_id?: string; bio?: string }) =>
  request.post('/admin/agents', data)

export const setAgentStatus = (id: number, status: string) =>
  request.put(`/admin/agents/${id}/status`, { status })

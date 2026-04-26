import request from './request'

export interface Property {
  id: number
  title: string
  property_type: string
  city: string
  district: string
  address: string
  total_price: number | null
  unit_price: number | null
  monthly_rent: number | null
  area: number
  bedrooms: number
  living_rooms: number
  bathrooms: number
  floor: number | null
  total_floors: number | null
  decoration: string
  direction: string
  description: string
  cover_image: string
  status: string
  view_count: number
  created_at: string
  updated_at: string
  images: PropertyImage[]
  agent?: AgentCard
}

export interface PropertyImage {
  id: number
  url: string
  sort_order: number
}

export interface AgentCard {
  id: number
  name: string
  phone: string
  wechat_id: string
  wechat_qr_url: string
  avatar_url: string
  bio: string
  agent_code: string
}

export interface PageResult<T> {
  code: number
  message: string
  data: {
    list: T[]
    total: number
    page: number
    limit: number
  }
}

export interface ApiResult<T> {
  code: number
  message: string
  data: T
}

export const getPropertyDetail = (id: number, agentCode?: string) =>
  request.get<unknown, ApiResult<Property>>(`/h5/property/${id}`, {
    params: agentCode ? { a: agentCode } : {},
  })

export const getPropertyList = (params: {
  page?: number
  limit?: number
  type?: string
  district?: string
  keyword?: string
  min_price?: number
  max_price?: number
}) => request.get<unknown, PageResult<Property>>('/h5/properties', { params })

export const getAgentProperties = (agentCode: string, params?: { page?: number; limit?: number }) =>
  request.get<unknown, PageResult<Property>>(`/h5/agent/${agentCode}`, { params })

export const claimProperty = (propertyId: number) =>
  request.post(`/agent/properties/${propertyId}/claim`)

export const unclaimProperty = (propertyId: number) =>
  request.delete(`/agent/properties/${propertyId}/claim`)

export const getMyProperties = (params?: { page?: number; limit?: number }) =>
  request.get<unknown, PageResult<Property>>('/agent/properties', { params })

export const getAllProperties = (params?: {
  page?: number
  limit?: number
  type?: string
  keyword?: string
}) => request.get<unknown, PageResult<Property>>('/agent/all-properties', { params })

export const createProperty = (data: FormData) =>
  request.post<unknown, ApiResult<Property>>('/agent/properties', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

export const uploadPropertyImage = (propertyId: number, data: FormData) =>
  request.post(`/agent/properties/${propertyId}/images`, data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

import request from './request'

export type PropertyType = 'second_hand' | 'new_home' | 'rent' | 'decoration' | 'commercial'
export type PropertyStatus = 'available' | 'sold' | 'rented' | 'offline'

export interface Property {
  id: number
  title: string
  property_type: PropertyType
  province: string
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
  status: PropertyStatus
  view_count: number
  created_at: string
  updated_at: string
  images: PropertyImage[]
  video_url: string
  vr_url: string
  tags: string
  latitude: number | null
  longitude: number | null
  community_name: string
  building_age: number | null
  parking: number | null
  has_elevator: boolean
  is_verified: boolean
  commission: number | null
  created_by: number
  owner_agent_id: number | null
  owner_agent_code?: string
  is_favorited: boolean
  is_claimed: boolean
  my_claim_commission: number | null
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
  claim_commission?: number | null
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

// H5公开接口（支持可选登录）
export const getPropertyDetail = (id: number, agentCode?: string, signal?: AbortSignal) =>
  request.get<unknown, ApiResult<Property>>(`/api/h5/property/${id}`, {
    params: agentCode ? { a: agentCode } : {},
    signal,
  })

export const getPropertyList = (params: {
  page?: number
  limit?: number
  type?: string
  district?: string
  keyword?: string
  min_price?: number
  max_price?: number
}) => request.get<unknown, PageResult<Property>>('/api/h5/properties', { params })

export const getAgentProperties = (agentCode: string, params?: { page?: number; limit?: number }) =>
  request.get<unknown, PageResult<Property>>(`/api/h5/agent/${agentCode}`, { params })

// 经纪人/管理员接口（需要认证）
export const claimProperty = (propertyId: number) =>
  request.post<unknown, ApiResult<{ claimed: boolean }>>(`/api/agent/properties/${propertyId}/claim`, {})

export const unclaimProperty = (propertyId: number) =>
  request.delete<unknown, ApiResult<unknown>>(`/api/agent/properties/${propertyId}/claim`)

export const getMyProperties = (params?: { page?: number; limit?: number }) =>
  request.get<unknown, PageResult<Property>>('/api/agent/properties', { params })

export const getAllProperties = (params?: {
  page?: number
  limit?: number
  type?: string
  keyword?: string
}) => request.get<unknown, PageResult<Property>>('/api/agent/all-properties', { params })

export const createProperty = (data: FormData) =>
  request.post<unknown, ApiResult<Property>>('/api/agent/properties', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

export const uploadPropertyImage = (propertyId: number, data: FormData) =>
  request.post(`/api/agent/properties/${propertyId}/images`, data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

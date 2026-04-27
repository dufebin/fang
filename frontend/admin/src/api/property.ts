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
}

export interface PageResult<T> {
  data: {
    list: T[]
    total: number
    page: number
    limit: number
  }
}

export const getProperties = (params: {
  page?: number
  limit?: number
  type?: string
  district?: string
  status?: string
  keyword?: string
}) => request.get<unknown, PageResult<Property>>('/admin/properties', { params })

export const createProperty = (data: FormData) =>
  request.post('/admin/properties', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

export const updateProperty = (id: number, data: Partial<Omit<Property, 'id' | 'view_count' | 'created_at' | 'updated_at'>>) =>
  request.put(`/admin/properties/${id}`, data)

export const updatePropertyStatus = (id: number, status: string) =>
  request.put(`/admin/properties/${id}/status`, { status })

export const uploadPropertyImage = (id: number, data: FormData) =>
  request.post(`/admin/properties/${id}/images`, data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

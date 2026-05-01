import request from './request'
import { ApiResult, PageResult } from './property'

export interface Article {
  id: number
  title: string
  category: string
  cover_image?: string
  content: string
  view_count: number
  published_at: string
}

export interface Banner {
  id: number
  title: string
  image_url: string
  link_type: 'property' | 'external' | 'none'
  link_value: string
  position: string
  sort_order: number
  is_active: boolean
}

export function getBanners() {
  return request.get<unknown, ApiResult<Banner[]>>('/api/h5/banners')
}

export function getArticleList(params: { page: number; page_size: number; category?: string }) {
  return request.get<unknown, PageResult<Article>>('/api/h5/articles', { params })
}

export function getArticleDetail(id: number) {
  return request.get<unknown, ApiResult<Article>>(`/api/h5/articles/${id}`)
}

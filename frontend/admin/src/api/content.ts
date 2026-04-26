import request from './request'

export interface Article {
  id: number
  title: string
  category: string
  cover_image?: string
  content: string
  status: 'draft' | 'published'
  view_count: number
  published_at?: string
  created_at: string
}

export interface Banner {
  id: number
  title: string
  image_url: string
  link_type: 'none' | 'property' | 'article' | 'url'
  link_value?: string
  position: 'home' | 'property_list'
  sort_order: number
  is_active: boolean
  created_at: string
}

export function getArticles(params: { page?: number; limit?: number; status?: string; keyword?: string }) {
  return request.get('/admin/articles', { params })
}
export function createArticle(data: Partial<Article>) {
  return request.post('/admin/articles', data)
}
export function updateArticle(id: number, data: Partial<Article>) {
  return request.put(`/admin/articles/${id}`, data)
}
export function deleteArticle(id: number) {
  return request.delete(`/admin/articles/${id}`)
}

export function getBanners(params?: { position?: string }) {
  return request.get('/admin/banners', { params })
}
export function createBanner(data: Partial<Banner>) {
  return request.post('/admin/banners', data)
}
export function updateBanner(id: number, data: Partial<Banner>) {
  return request.put(`/admin/banners/${id}`, data)
}
export function deleteBanner(id: number) {
  return request.delete(`/admin/banners/${id}`)
}

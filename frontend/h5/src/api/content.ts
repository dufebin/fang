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

export function getArticleList(params: { page: number; page_size: number; category?: string }) {
  return request.get<unknown, PageResult<Article>>('/h5/articles', { params })
}

export function getArticleDetail(id: number) {
  return request.get<unknown, ApiResult<Article>>(`/h5/articles/${id}`)
}

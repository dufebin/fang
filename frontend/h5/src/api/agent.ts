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

export interface ApiResult<T> {
  code: number
  message: string
  data: T
}

export const getMyProfile = () =>
  request.get<unknown, ApiResult<Agent>>('/agent/profile')

export const updateMyProfile = (data: Partial<Agent>) =>
  request.put<unknown, ApiResult<Agent>>('/agent/profile', data)

export const getJSSDKConfig = (url: string) =>
  request.get('/h5/wechat/jssdk-config', { params: { url } })

export const wechatLogin = (code: string) =>
  request.get<unknown, ApiResult<{ token: string; user: { role: string; user_id: number } }>>(
    `/auth/wechat/callback?code=${code}`
  )

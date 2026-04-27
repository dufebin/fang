import axios from 'axios'

const request = axios.create({
  baseURL: '/api',
  timeout: 10000,
})

request.interceptors.request.use((config) => {
  // 公开接口（/h5/* 或 /api/h5/*）不带上token
  if (config.url?.startsWith('/h5/') || config.url?.startsWith('/api/h5/')) {
    return config
  }
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

request.interceptors.response.use(
  (res) => {
    const data = res.data
    if (data.code === 401) {
      localStorage.removeItem('token')
      const redirectUrl = encodeURIComponent(window.location.href)
      window.location.href = `/api/auth/wechat/redirect?redirect_to=${redirectUrl}`
      return Promise.reject(new Error('未授权'))
    }
    return data
  },
  (err) => {
    return Promise.reject(err)
  }
)

export default request

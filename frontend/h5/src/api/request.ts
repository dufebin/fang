import axios from 'axios'

const request = axios.create({
  baseURL: '/api',
  timeout: 10000,
})

request.interceptors.request.use((config) => {
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

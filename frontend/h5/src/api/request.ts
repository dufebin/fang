import axios from 'axios'

const request = axios.create({
  baseURL: 'https://fapi.sanjiufangchan.cn',
  timeout: 10000,
})

request.interceptors.request.use((config) => {
  // 公开接口允许匿名访问；已登录时携带 token 以返回收藏、认领等个人状态
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
      window.location.href = `https://fapi.sanjiufangchan.cn/api/auth/wechat/redirect?redirect_to=${redirectUrl}`
      return Promise.reject(new Error('未授权'))
    }
    return data
  },
  (err) => {
    return Promise.reject(err)
  }
)

export default request

import axios from 'axios'
import { message } from 'antd'

const request = axios.create({
  baseURL: 'https://fapi.deephealth.net/api',
  timeout: 15000,
})

request.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

request.interceptors.response.use(
  (res) => {
    const data = res.data
    if (data.code === 401) {
      localStorage.removeItem('admin_token')
      window.location.href = '/admin/login'
      return Promise.reject(new Error('未授权'))
    }
    if (data.code !== 0) {
      message.error(data.message || '请求失败')
      return Promise.reject(new Error(data.message))
    }
    return data
  },
  (err) => {
    const msg = err.response?.data?.message || err.message || '网络错误'
    message.error(msg)
    return Promise.reject(err)
  }
)

export default request

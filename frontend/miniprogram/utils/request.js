const { BASE_URL } = require('./config')
const { getToken, clearToken } = require('./auth')

function request({ url, method = 'GET', data, showLoading = false }) {
  return new Promise((resolve, reject) => {
    if (showLoading) {
      wx.showLoading({ title: '加载中...', mask: true })
    }

    const token = getToken()
    const header = { 'Content-Type': 'application/json' }
    if (token) {
      header['Authorization'] = 'Bearer ' + token
    }

    wx.request({
      url: BASE_URL + url,
      method,
      data,
      header,
      success(res) {
        if (showLoading) wx.hideLoading()

        const body = res.data
        if (res.statusCode === 401) {
          clearToken()
          getApp().logout()
          wx.navigateTo({ url: '/pages/login/index' })
          reject(new Error('未登录'))
          return
        }
        if (body && body.code === 0) {
          resolve(body.data)
        } else {
          const msg = (body && body.message) || '请求失败'
          wx.showToast({ title: msg, icon: 'none' })
          reject(new Error(msg))
        }
      },
      fail(err) {
        if (showLoading) wx.hideLoading()
        wx.showToast({ title: '网络异常，请重试', icon: 'none' })
        reject(err)
      },
    })
  })
}

function upload({ url, filePath, name = 'image', formData }) {
  return new Promise((resolve, reject) => {
    const token = getToken()
    const header = {}
    if (token) {
      header['Authorization'] = 'Bearer ' + token
    }
    wx.uploadFile({
      url: BASE_URL + url,
      filePath,
      name,
      formData,
      header,
      success(res) {
        const body = JSON.parse(res.data)
        if (body && body.code === 0) {
          resolve(body.data)
        } else {
          reject(new Error((body && body.message) || '上传失败'))
        }
      },
      fail: reject,
    })
  })
}

module.exports = { request, upload }

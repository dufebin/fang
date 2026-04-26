const TOKEN_KEY = 'fc_token'

function getToken() {
  return wx.getStorageSync(TOKEN_KEY) || null
}

function setToken(token) {
  wx.setStorageSync(TOKEN_KEY, token)
}

function clearToken() {
  wx.removeStorageSync(TOKEN_KEY)
}

// 判断是否已登录
function isLoggedIn() {
  return !!getToken()
}

// 需要登录时调用：跳转登录页，登录后返回
function requireLogin(callback) {
  if (isLoggedIn()) {
    callback && callback()
    return
  }
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  const route = currentPage ? '/' + currentPage.route : ''
  wx.navigateTo({
    url: `/pages/login/index?redirect=${encodeURIComponent(route)}`,
  })
}

// 小程序静默登录（获取 openid）
function silentLogin() {
  return new Promise((resolve, reject) => {
    wx.login({
      success(res) {
        if (res.code) {
          resolve(res.code)
        } else {
          reject(new Error('wx.login failed'))
        }
      },
      fail: reject,
    })
  })
}

module.exports = { getToken, setToken, clearToken, isLoggedIn, requireLogin, silentLogin }

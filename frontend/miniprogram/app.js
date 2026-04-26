const { getToken, clearToken } = require('./utils/auth')

App({
  globalData: {
    userInfo: null,
    token: null,
    isAgent: false,
    isAdmin: false,
  },

  onLaunch() {
    this.globalData.token = getToken()
    if (this.globalData.token) {
      this._fetchUserInfo()
    }
  },

  _fetchUserInfo() {
    const { request } = require('./utils/request')
    request({ url: '/auth/me' })
      .then(user => {
        this.globalData.userInfo = user
        this.globalData.isAgent = user.role === 'agent' || user.role === 'admin'
        this.globalData.isAdmin = user.role === 'admin'
      })
      .catch(() => {
        clearToken()
        this.globalData.token = null
      })
  },

  // 登录后刷新全局状态
  onLoginSuccess(userInfo, token) {
    this.globalData.token = token
    this.globalData.userInfo = userInfo
    this.globalData.isAgent = userInfo.role === 'agent' || userInfo.role === 'admin'
    this.globalData.isAdmin = userInfo.role === 'admin'
  },

  // 退出登录
  logout() {
    clearToken()
    this.globalData.token = null
    this.globalData.userInfo = null
    this.globalData.isAgent = false
    this.globalData.isAdmin = false
  },
})

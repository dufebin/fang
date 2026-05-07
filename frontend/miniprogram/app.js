const { getToken, clearToken } = require('./utils/auth')

App({
  globalData: {
    userInfo: null,
    token: null,
    isAgent: false,
    isAdmin: false,
  },

  onLaunch() {
    // 全局错误监听（不捕获，只记录）
    console.log('[App] onLaunch')
    this.globalData.token = getToken()
    if (this.globalData.token) {
      this._fetchUserInfo()
    }
  },

  onError(err) {
    console.error('[App] Global error:', err)
  },

  _fetchUserInfo() {
    var self = this
    // 延迟 require，确保小程序完全初始化
    try {
      var requestModule = require('./utils/request')
      requestModule.request({ url: '/auth/me' }).then(function(user) {
        self.globalData.userInfo = user
        self.globalData.isAgent = user.role === 'agent' || user.role === 'admin'
        self.globalData.isAdmin = user.role === 'admin'
      }).catch(function() {
        clearToken()
        self.globalData.token = null
      })
    } catch (e) {
      console.error('[App] _fetchUserInfo error:', e)
    }
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

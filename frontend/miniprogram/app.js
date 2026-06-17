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
    try {
      var requestModule = require('./utils/request')
      requestModule.request({ url: '/auth/me' }).then(function(user) {
        // 后端返回 avatar_url，统一为 avatar 方便前端使用
        user.avatar = user.avatar_url || user.avatar || ''
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
    // 统一 avatar 字段（兼容 avatar_url / avatarUrl 等来源）
    // 过滤掉本地资源路径（/assets/...），只保留可被显示的 URL
    var raw = userInfo.avatar_url || userInfo.avatar || userInfo.avatarUrl || ''
    userInfo.avatar = (raw && !raw.startsWith('/assets/') && !raw.startsWith('./')) ? raw : ''
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

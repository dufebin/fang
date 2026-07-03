const { getToken, clearToken } = require('./utils/auth')
const coverConfig = require('./utils/cover-config')

App({
  globalData: {
    userInfo: null,
    token: null,
    isAgent: false,
    isAdmin: false,
    userOpenid: '',
  },

  onLaunch() {
    // 全局错误监听（不捕获，只记录）
    console.log('[App] onLaunch')
    this.globalData.token = getToken()
    if (this.globalData.token) {
      this._fetchUserInfo()
    }
    // 默认入口为房产系统首页（app.json 中 pages/index/index 在第一位）
    // 停车白名单用户在 _fetchUserInfo 返回后跳转到停车页
  },

  onError(err) {
    console.error('[App] Global error:', err)
  },

  // 隐私保护：进入后台时记录时间戳
  onHide() {
    this._backgroundedAt = Date.now()
  },

  // 隐私保护：回到前台时，仅停车白名单用户跳回停车页
  onShow() {
    if (this._backgroundedAt) {
      this._backgroundedAt = 0
      if (!coverConfig.redirectOnResume) return
      if (!coverConfig.shouldShowParking(this.globalData.userOpenid)) return
      try {
        const pages = getCurrentPages()
        const current = pages[pages.length - 1]
        const route = current ? current.route : ''
        const coverRoute = coverConfig.coverPath.replace(/^\//, '')
        if (route && route !== coverRoute) {
          wx.reLaunch({ url: coverConfig.coverPath })
        }
      } catch (e) {
        console.error('[App] onShow redirect error:', e)
      }
    }
  },

  _fetchUserInfo() {
    var self = this
    try {
      var requestModule = require('./utils/request')
      requestModule.request({ url: '/auth/me' }).then(function(user) {
        // 后端返回 avatar_url，统一为 avatar 方便前端使用
        user.avatar = user.avatar_url || user.avatar || ''
        self.globalData.userInfo = user
        self.globalData.userOpenid = user.open_id || user.openid || ''
        self.globalData.isAgent = user.role === 'agent' || user.role === 'admin'
        self.globalData.isAdmin = user.role === 'admin'
        // 停车白名单用户：若不在停车页则跳转过去
        if (coverConfig.shouldShowParking(self.globalData.userOpenid)) {
          try {
            var pages = getCurrentPages()
            var current = pages[pages.length - 1]
            var route = current ? current.route : ''
            var coverRoute = coverConfig.coverPath.replace(/^\//, '')
            if (route !== coverRoute) {
              wx.reLaunch({ url: coverConfig.coverPath })
            }
          } catch (e) {
            console.error('[App] redirect to parking error:', e)
          }
        }
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
    this.globalData.userOpenid = userInfo.openid || userInfo.open_id || ''
    this.globalData.isAgent = userInfo.role === 'agent' || userInfo.role === 'admin'
    this.globalData.isAdmin = userInfo.role === 'admin'
  },

  // 退出登录
  logout() {
    clearToken()
    this.globalData.token = null
    this.globalData.userInfo = null
    this.globalData.userOpenid = ''
    this.globalData.isAgent = false
    this.globalData.isAdmin = false
  },
})

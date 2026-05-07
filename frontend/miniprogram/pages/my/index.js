const { getMe, listFavorites, listHistory, listNotifications, mockAgentLogin } = require('../../api/user')
const { listMyAppointments } = require('../../api/appointment')
const { fullImageURL } = require('../../utils/format')
const { isLoggedIn } = require('../../utils/auth')

// Promise 化 wx.showModal
function showModal(opts) {
  return new Promise((resolve) => {
    wx.showModal({
      ...opts,
      success: resolve,
      fail: () => resolve({ confirm: false }),
    })
  })
}

Page({
  data: {
    isLoggedIn: false,
    isAgent: false,
    userInfo: {},
    avatarUrl: '/assets/icons/default-avatar.png',
    stats: { favoriteCount: 0, appointmentCount: 0, historyCount: 0 },
    unreadCount: 0,
  },

  onShow() {
    const loggedIn = isLoggedIn()
    this.setData({ isLoggedIn: loggedIn })
    if (loggedIn) {
      this._loadUser()
      this._loadStats()
    }
  },

  async _loadUser() {
    try {
      const app = getApp()
      const user = app.globalData.userInfo
      if (user) {
        this.setData({
          userInfo: user,
          isAgent: app.globalData.isAgent,
          avatarUrl: user.avatar ? fullImageURL(user.avatar) : '/assets/icons/default-avatar.png',
        })
      }
      const fresh = await getMe()
      getApp().globalData.userInfo = fresh
      this.setData({
        userInfo: fresh,
        isAgent: !!fresh.agent_id,
        avatarUrl: fresh.avatar ? fullImageURL(fresh.avatar) : '/assets/icons/default-avatar.png',
      })
    } catch (_) {}
  },

  async _loadStats() {
    try {
      const [favRes, apptRes, histRes, notifRes] = await Promise.all([
        listFavorites({ page: 1, page_size: 1 }),
        listMyAppointments(),
        listHistory({ page: 1, page_size: 1 }),
        listNotifications({ unread_only: true }),
      ])
      this.setData({
        stats: {
          favoriteCount: favRes.total || 0,
          appointmentCount: (apptRes || []).length,
          historyCount: histRes.total || 0,
        },
        unreadCount: (notifRes || []).filter(n => !n.is_read).length,
      })
    } catch (_) {}
  },

  onLogin() { wx.navigateTo({ url: '/pages/login/index' }) },

  async onMockLogin() {
    try {
      wx.showLoading({ title: '登录中...' })
      const res = await mockAgentLogin()
      wx.hideLoading()
      const { setToken } = require('../../utils/auth')
      setToken(res.token)
      getApp().globalData.token = res.token
      getApp().globalData.isAgent = true
      getApp().globalData.userInfo = { role: res.role, agent_id: res.agent_id, nickname: res.nickname }
      this.setData({ isLoggedIn: true, isAgent: true })
      this._loadUser()
      wx.showToast({ title: '模拟登录成功', icon: 'success' })
    } catch (e) {
      wx.hideLoading()
      const msg = (e && (e.message || e.errMsg)) || '未知错误'
      console.error('[mockLogin]', e)
      wx.showModal({ title: '登录失败', content: msg, showCancel: false })
    }
  },
  onFavorites() { wx.navigateTo({ url: '/pages/my-favorites/index' }) },
  onAppointments() { wx.navigateTo({ url: '/pages/appointment/index' }) },
  onHistory() { wx.navigateTo({ url: '/pages/my-history/index' }) },
  onNotifications() { wx.navigateTo({ url: '/pages/my-notifications/index' }) },
  onAgentWorkbench() { wx.navigateTo({ url: '/pages/agent-workbench/index' }) },
  onApplyAgent() { wx.navigateTo({ url: '/pages/agent-apply/index' }) },
  onLoanCalc() { wx.navigateTo({ url: '/pages/loan-calculator/index' }) },
  onArticles() { wx.navigateTo({ url: '/pages/article-list/index' }) },

  async onLogout() {
    const res = await showModal({ title: '确认退出', content: '确定要退出登录吗？' })
    if (!res.confirm) return
    getApp().logout()
    this.setData({
      isLoggedIn: false,
      userInfo: {},
      avatarUrl: '/assets/icons/default-avatar.png',
    })
  },
})

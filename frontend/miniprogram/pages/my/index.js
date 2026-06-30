const { getMe, listFavorites, listHistory, listNotifications } = require('../../api/user')
const { setToken } = require('../../utils/auth')
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
    // 隐藏入口状态
    showPasswordModal: false,
    passwordInput: '',
    passwordError: false,
  },

  _tapCount: 0,
  _lastTapTime: 0,

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
      if (fresh.new_token) setToken(fresh.new_token)
      getApp().globalData.userInfo = fresh
      this.setData({
        userInfo: fresh,
        isAgent: !!fresh.agent_id,
        avatarUrl: fresh.avatar ? fullImageURL(fresh.avatar) : '/assets/icons/default-avatar.png',
      })
    } catch (_) {}
  },

  async _loadStats() {
    const [favRet, apptRet, histRet, notifRet] = await Promise.allSettled([
      listFavorites({ page: 1, limit: 1 }),
      listMyAppointments({ page: 1, limit: 1 }),
      listHistory({ page: 1, limit: 1 }),
      listNotifications({ unread_only: true }),
    ])

    const favRes = favRet.status === 'fulfilled' ? favRet.value : null
    const apptRes = apptRet.status === 'fulfilled' ? apptRet.value : null
    const histRes = histRet.status === 'fulfilled' ? histRet.value : null
    const notifRes = notifRet.status === 'fulfilled' ? notifRet.value : null

    const appointmentList = Array.isArray(apptRes)
      ? apptRes
      : (apptRes && Array.isArray(apptRes.list) ? apptRes.list : [])
    const notificationList = Array.isArray(notifRes)
      ? notifRes
      : (notifRes && Array.isArray(notifRes.list) ? notifRes.list : [])
    const unreadCount = typeof (notifRes && notifRes.unread) === 'number'
      ? notifRes.unread
      : notificationList.filter(n => !n.is_read).length

    this.setData({
      stats: {
        favoriteCount: (favRes && typeof favRes.total === 'number') ? favRes.total : 0,
        appointmentCount: appointmentList.length,
        historyCount: (histRes && typeof histRes.total === 'number') ? histRes.total : 0,
      },
      unreadCount,
    })
  },

  onLogin() { wx.navigateTo({ url: '/pages/login/index' }) },

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

  onServiceTitleTap() {
    const now = Date.now()
    if (now - this._lastTapTime > 3000) {
      this._tapCount = 0
    }
    this._tapCount++
    this._lastTapTime = now
    if (this._tapCount >= 6) {
      this._tapCount = 0
      this.setData({ showPasswordModal: true, passwordInput: '', passwordError: false })
    }
  },

  onPasswordInput(e) {
    this.setData({ passwordInput: e.detail.value, passwordError: false })
  },

  onPasswordConfirm() {
    if (this.data.passwordInput === '888888') {
      this.setData({ showPasswordModal: false, passwordInput: '' })
      wx.navigateTo({ url: '/pages/chat-list/index' })
    } else {
      this.setData({ passwordError: true, passwordInput: '' })
    }
  },

  onPasswordCancel() {
    this.setData({ showPasswordModal: false, passwordInput: '', passwordError: false })
  },

  onDialogTap() {},

  onMaskTap() {
    this.setData({ showPasswordModal: false, passwordInput: '', passwordError: false })
  },
})

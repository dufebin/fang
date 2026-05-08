const { silentLogin, setToken } = require('../../utils/auth')
const { mpLogin } = require('../../api/user')

// Promise 化 wx.getUserProfile
function getUserProfile(opts) {
  return new Promise((resolve, reject) => {
    wx.getUserProfile({
      ...opts,
      success: resolve,
      fail: reject,
    })
  })
}

Page({
  data: { loading: false },

  onLoad(options) {
    this._redirect = options.redirect || ''
  },

  async onLogin() {
    this.setData({ loading: true })
    try {
      // 1. 获取微信登录凭证
      const code = await silentLogin()

      // 2. 获取用户基本信息（新版 API）
      const profileRes = await getUserProfile({ desc: '用于完善个人资料' })
      const userInfo = profileRes.userInfo

      // 3. 后端登录，返回 { token, user }
      const loginRes = await mpLogin(code, userInfo.nickName, userInfo.avatarUrl)

      // 4. 持久化 JWT，更新全局状态
      setToken(loginRes.token)
      getApp().onLoginSuccess({ ...userInfo, role: loginRes.user.role }, loginRes.token)

      // 5. 跳转
      if (this._redirect) {
        wx.redirectTo({ url: decodeURIComponent(this._redirect) })
      } else {
        wx.navigateBack({ delta: 1 })
      }
    } catch (e) {
      console.error('登录失败:', e)
      wx.showToast({ title: '登录失败，请重试', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },
})

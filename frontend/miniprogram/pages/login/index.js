const { silentLogin } = require('../../utils/auth')
const { mpLogin, updateProfile } = require('../../api/user')

Page({
  data: { loading: false },

  onLoad(options) {
    this._redirect = options.redirect || ''
  },

  async onGetUserInfo(e) {
    if (!e.detail.userInfo) return
    this.setData({ loading: true })
    try {
      const code = await silentLogin()
      const { userInfo } = e.detail
      const token = await mpLogin(code, userInfo.nickName, userInfo.avatarUrl)
      await updateProfile({ nickname: userInfo.nickName, avatar: userInfo.avatarUrl })
      getApp().onLoginSuccess(token, userInfo)
      if (this._redirect) {
        wx.redirectTo({ url: decodeURIComponent(this._redirect) })
      } else {
        wx.navigateBack({ delta: 1 })
      }
    } catch (_) {
      wx.showToast({ title: '登录失败，请重试', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },
})

const { silentLogin, setToken } = require('../../utils/auth')
const { mpLogin } = require('../../api/user')

const DEFAULT_AVATAR = '/assets/icons/default-avatar.png'
// 微信占位昵称，出现时说明获取到的是默认值
const WX_PLACEHOLDER_NICK = '微信用户'

Page({
  data: {
    loading: false,
    avatarUrl: DEFAULT_AVATAR,
    nickname: '',
  },

  onLoad(options) {
    this._redirect = options.redirect || ''
    this._tryAutoProfile()
  },

  // 静默尝试获取微信资料（开发工具 / 旧版微信有效；新版微信返回占位符会被过滤）
  _tryAutoProfile() {
    const self = this
    wx.getUserInfo({
      withCredentials: false,
      success(res) {
        const info = res.userInfo || {}
        if (info.nickName && info.nickName !== WX_PLACEHOLDER_NICK) {
          self.setData({
            nickname: info.nickName,
            avatarUrl: info.avatarUrl || DEFAULT_AVATAR,
          })
        }
      },
      fail() {},
    })
  },

  // open-type="chooseAvatar" 回调，生产环境获取真实微信头像的唯一方式
  onChooseAvatar(e) {
    this.setData({ avatarUrl: e.detail.avatarUrl || DEFAULT_AVATAR })
  },

  // type="nickname" 输入框，微信会自动弹出昵称建议
  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value })
  },

  async onLogin() {
    this.setData({ loading: true })
    try {
      const code = await silentLogin()

      // 只把真实 http(s) URL 传给后端；本地路径无法被服务端访问
      const avatarToSend = this.data.avatarUrl.startsWith('http') ? this.data.avatarUrl : ''
      const loginRes = await mpLogin(code, this.data.nickname, avatarToSend)

      setToken(loginRes.token)
      // avatarUrl 作为即时展示用（wxfile:// 或 https:// 均可在小程序内显示）
      getApp().onLoginSuccess({ ...loginRes.user, avatarUrl: this.data.avatarUrl }, loginRes.token)

      const url = this._redirect ? decodeURIComponent(this._redirect) : ''
      if (url) {
        const TAB_PAGES = ['/pages/index/index', '/pages/property-list/index', '/pages/map-search/index', '/pages/my/index']
        TAB_PAGES.some(p => url.startsWith(p))
          ? wx.switchTab({ url })
          : wx.navigateTo({ url })
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

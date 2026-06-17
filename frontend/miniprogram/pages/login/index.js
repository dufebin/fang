const { silentLogin, setToken } = require('../../utils/auth')
const { mpLogin, uploadAvatar } = require('../../api/user')

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

      let avatarToSend = ''
      let finalAvatarUrl = this.data.avatarUrl

      // 如果头像是本地路径（wxfile://），先上传到后端获取 HTTP URL
      if (this.data.avatarUrl.startsWith('wxfile://')) {
        wx.showLoading({ title: '上传头像中...', mask: true })
        try {
          const uploadRes = await uploadAvatar(this.data.avatarUrl)
          wx.hideLoading()
          
          if (!uploadRes.url) {
            throw new Error('上传成功但未返回 URL')
          }
          
          avatarToSend = uploadRes.url
          finalAvatarUrl = uploadRes.url
        } catch (uploadErr) {
          wx.hideLoading()
          console.error('头像上传失败:', uploadErr)
          
          // 给用户可见的提示（但不阻断登录）
          wx.showToast({ 
            title: '头像上传失败，使用默认头像', 
            icon: 'none',
            duration: 2000
          })
          
          avatarToSend = ''
          finalAvatarUrl = DEFAULT_AVATAR
        }
      } else if (this.data.avatarUrl.startsWith('http')) {
        // 已经是 HTTP URL，直接发送
        avatarToSend = this.data.avatarUrl
      }

      const loginRes = await mpLogin(code, this.data.nickname, avatarToSend)

      setToken(loginRes.token)
      // 使用最终头像 URL 显示
      getApp().onLoginSuccess({ ...loginRes.user, avatarUrl: finalAvatarUrl }, loginRes.token)

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

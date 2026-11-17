const { uploadAvatar, updateProfile } = require('../../api/user')
const { fullImageURL } = require('../../utils/format')

const DEFAULT_AVATAR = '/assets/icons/default-avatar.png'

Page({
  data: {
    avatarUrl: DEFAULT_AVATAR,
    nickname: '',
    saving: false,
    _avatarChanged: false,
  },

  onLoad() {
    const user = getApp().globalData.userInfo || {}
    const src = user.avatar || user.avatarUrl || ''
    let avatarUrl = DEFAULT_AVATAR
    if (src && !src.startsWith('/assets/') && !src.startsWith('./')) {
      avatarUrl = (src.startsWith('http') || src.startsWith('wxfile://')) ? src : fullImageURL(src)
    }
    this.setData({ avatarUrl, nickname: user.nickname || '' })
  },

  // open-type="chooseAvatar" 回调，生产环境获取真实微信头像的唯一方式
  onChooseAvatar(e) {
    this.setData({ avatarUrl: e.detail.avatarUrl || DEFAULT_AVATAR, _avatarChanged: true })
  },

  // type="nickname" 输入框，微信会自动弹出昵称建议
  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value })
  },

  async onSave() {
    if (this.data.saving) return
    this.setData({ saving: true })
    try {
      let avatarToSend = ''
      // 头像改过且是本地临时路径时，先上传到后端
      if (this.data._avatarChanged) {
        const isLocalTemp = this.data.avatarUrl.startsWith('wxfile://') || this.data.avatarUrl.startsWith('http://tmp/')
        if (isLocalTemp) {
          wx.showLoading({ title: '上传头像中...', mask: true })
          const uploadRes = await uploadAvatar(this.data.avatarUrl)
          wx.hideLoading()
          if (!uploadRes.url) throw new Error('上传成功但未返回 URL')
          avatarToSend = uploadRes.url
        } else if (this.data.avatarUrl.startsWith('http')) {
          avatarToSend = this.data.avatarUrl
        }
      }

      // 昵称留空时后端保留原值；头像未改发送空串同样保留原值
      const user = await updateProfile({ nickname: this.data.nickname, avatar: avatarToSend })

      // 同步全局用户信息并返回
      const app = getApp()
      const merged = { ...app.globalData.userInfo, ...user, avatar: (user && user.avatar_url) || (user && user.avatar) || avatarToSend }
      app.globalData.userInfo = merged
      wx.showToast({ title: '已保存' })
      setTimeout(() => wx.navigateBack(), 600)
    } catch (e) {
      wx.hideLoading()
      console.error('保存资料失败:', e)
      wx.showToast({ title: '保存失败，请重试', icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  },
})

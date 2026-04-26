const { getProfile } = require('../../api/agent')
const { fullImageURL } = require('../../utils/format')
const { BASE_URL } = require('../../utils/config')

Page({
  data: {
    agent: {},
    avatarUrl: '/assets/icons/default-avatar.png',
    qrCode: '/assets/icons/qr-placeholder.png',
    shareLink: '',
  },

  async onLoad() {
    try {
      const profile = await getProfile()
      const shareLink = `${BASE_URL.replace('/api', '')}/h5/agent/${profile.agent_code}`
      this.setData({
        agent: profile,
        avatarUrl: profile.avatar ? fullImageURL(profile.avatar) : '/assets/icons/default-avatar.png',
        shareLink,
      })
    } catch (_) {}
  },

  onSavePoster() {
    wx.showToast({ title: '请截图保存名片', icon: 'none' })
  },

  onCopyLink() {
    wx.setClipboardData({
      data: this.data.shareLink,
      success: () => wx.showToast({ title: '链接已复制' }),
    })
  },

  onShareAppMessage() {
    const a = this.data.agent
    return {
      title: `${a.name || '经纪人'}的房源推荐`,
      path: `/pages/index/index?a=${a.agent_code}`,
    }
  },
})

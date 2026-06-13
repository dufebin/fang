const { getProfile, getAgentHome } = require('../../api/agent')
const { fullImageURL } = require('../../utils/format')

Page({
  data: {
    agent: {},
    avatarUrl: '/assets/icons/default-avatar.png',
    qrUrl: '',
    shareLink: '',
  },

  async onLoad(options) {
    try {
      const { H5_BASE_URL } = require('../../utils/config')
      const sharedCode = options && options.a ? decodeURIComponent(options.a) : ''
      let profile = null
      if (sharedCode) {
        const home = await getAgentHome(sharedCode, { page: 1, page_size: 1 })
        profile = (home && home.agent) || null
      } else {
        profile = await getProfile()
      }
      if (!profile) throw new Error('经纪人信息不存在')
      const shareLink = profile.agent_code ? `${H5_BASE_URL}/agent/${encodeURIComponent(profile.agent_code)}` : ''
      const avatar = profile.avatar_url || profile.avatar || ''
      this.setData({
        agent: profile,
        avatarUrl: avatar ? fullImageURL(avatar) : '/assets/icons/default-avatar.png',
        qrUrl: profile.wechat_qr_url ? fullImageURL(profile.wechat_qr_url) : '',
        shareLink,
      })
    } catch (_) {}
  },

  onSavePoster() {
    wx.showToast({ title: '请截图保存名片', icon: 'none' })
  },

  onCopyLink() {
    if (!this.data.shareLink) {
      wx.showToast({ title: '暂无可复制链接', icon: 'none' })
      return
    }
    wx.setClipboardData({
      data: this.data.shareLink,
      success: () => wx.showToast({ title: '链接已复制' }),
    })
  },

  onShareAppMessage() {
    const a = this.data.agent
    const path = a.agent_code ? `/pages/index/index?a=${encodeURIComponent(a.agent_code)}` : '/pages/index/index'
    return {
      title: `${a.name || '经纪人'}的房源推荐`,
      path,
    }
  },

  onShareTimeline() {
    const a = this.data.agent
    return {
      title: `${a.name || '经纪人'}的房源推荐`,
      query: a.agent_code ? `a=${encodeURIComponent(a.agent_code)}` : '',
    }
  },
})

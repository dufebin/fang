const { fullImageURL } = require('../../utils/format')

Component({
  properties: {
    agent: { type: Object, value: {} },
    showActions: { type: Boolean, value: true },
  },

  methods: {
    onCall() {
      const phone = this.properties.agent.phone
      if (!phone) return
      wx.makePhoneCall({ phoneNumber: phone })
    },

    onViewHome() {
      const code = this.properties.agent.agent_code
      if (!code) return
      wx.navigateTo({ url: `/pages/agent-home/index?code=${code}` })
    },
  },

  lifetimes: {
    attached() {
      const a = this.properties.agent
      this.setData({
        avatarUrl: a.avatar ? fullImageURL(a.avatar) : '/assets/icons/default-avatar.png',
      })
    },
  },

  data: {
    avatarUrl: '/assets/icons/default-avatar.png',
  },
})

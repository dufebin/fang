const { isLoggedIn } = require('../../utils/auth')

Page({
  data: {},

  onShow() {
    if (!isLoggedIn()) {
      wx.navigateTo({ url: '/pages/login/index' })
      return
    }
    const app = getApp()
    const userInfo = app.globalData.userInfo || {}
    const isAgent = app.globalData.isAgent || !!userInfo.agent_id
    if (isAgent) {
      wx.navigateTo({ url: '/pages/agent-workbench/index' })
    } else {
      wx.navigateTo({ url: '/pages/agent-apply/index' })
    }
  },
})

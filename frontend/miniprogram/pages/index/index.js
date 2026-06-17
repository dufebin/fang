const { listProperties } = require('../../api/property')
const { fullImageURL } = require('../../utils/format')
const { isLoggedIn } = require('../../utils/auth')

const PAGE_SIZE = 10

Page({
  data: {
    userInfo: {},
    avatarUrl: '/assets/icons/default-avatar.png',
    list: [],
    page: 1,
    loading: false,
    noMore: false,
    _firstLoaded: false,
  },

  onLoad() {
    this._loadUser()
    this._loadList(true)
  },

  onShow() {
    if (this.data._firstLoaded) {
      this._loadUser()
    }
  },

  _loadUser() {
    try {
      const user = getApp().globalData.userInfo
      if (user) {
        const src = user.avatar || user.avatarUrl || ''
        // 本地资源路径不能走 fullImageURL（会拼接上传 base）
        // http/https → 直接用；wxfile:// → 小程序内直接用；相对路径 → fullImageURL
        let avatarUrl = '/assets/icons/default-avatar.png'
        if (src && !src.startsWith('/assets/') && !src.startsWith('./')) {
          avatarUrl = (src.startsWith('http') || src.startsWith('wxfile://'))
            ? src
            : fullImageURL(src)
        }
        this.setData({ userInfo: user, avatarUrl })
      }
    } catch (_) {}
  },

  async _loadList(reset) {
    if (this.data.loading) return
    if (!reset && this.data.noMore) return

    const page = reset ? 1 : this.data.page
    this.setData({ loading: true })

    try {
      const res = await listProperties({ page, page_size: PAGE_SIZE, sort: 'created_at' })
      const newList = res.list || []
      this.setData({
        list: reset ? newList : [...this.data.list, ...newList],
        page: page + 1,
        noMore: newList.length < PAGE_SIZE,
        _firstLoaded: true,
      })
    } catch (_) {
      wx.showToast({ title: '加载失败，请下拉刷新', icon: 'none' })
    }

    this.setData({ loading: false })
  },

  onAvatarTap() {
    if (!isLoggedIn()) {
      wx.navigateTo({ url: '/pages/login/index' })
      return
    }
    wx.navigateTo({ url: '/pages/agent-workbench/index' })
  },

  onAgentTap() {
    if (!isLoggedIn()) {
      wx.navigateTo({
        url: '/pages/login/index?redirect=' + encodeURIComponent('/pages/agent-apply/index'),
      })
      return
    }
    wx.navigateTo({ url: '/pages/agent-apply/index' })
  },

  onReachBottom() {
    this._loadList(false)
  },

  onPullDownRefresh() {
    this._loadList(true).then(() => wx.stopPullDownRefresh())
  },
})

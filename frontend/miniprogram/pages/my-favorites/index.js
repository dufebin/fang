const { listFavorites } = require('../../api/user')

const PAGE_SIZE = 10

Page({
  data: { list: [], page: 1, loading: false, noMore: false },

  onLoad() { this._load(true) },
  onPullDownRefresh() { this._load(true).then(() => wx.stopPullDownRefresh()) },
  onReachBottom() { this._load(false) },

  async _load(reset) {
    if (this.data.loading || (!reset && this.data.noMore)) return
    const page = reset ? 1 : this.data.page
    this.setData({ loading: true })
    try {
      const res = await listFavorites({ page, page_size: PAGE_SIZE })
      const items = res.list || []
      this.setData({
        list: reset ? items : [...this.data.list, ...items],
        page: page + 1,
        noMore: items.length < PAGE_SIZE,
      })
    } catch (_) {}
    this.setData({ loading: false })
  },

  onFindHouse() { wx.switchTab({ url: '/pages/property-list/index' }) },
})

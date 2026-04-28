const { listProperties } = require('../../api/property')

const PAGE_SIZE = 10

Page({
  data: {
    list: [],
    page: 1,
    loading: false,
    noMore: false,
    keyword: '',
    sort: 'created_at',
    showFilter: false,
    activeFilter: {},
    sortOptions: [
      { label: '最新', value: 'created_at' },
      { label: '价格低', value: 'price_asc' },
      { label: '价格高', value: 'price_desc' },
      { label: '面积', value: 'area' },
    ],
  },

  onLoad() {
    // check pending filter from homepage quick-nav
    const app = getApp()
    if (app.globalData.pendingFilter) {
      this.setData({ activeFilter: app.globalData.pendingFilter })
      app.globalData.pendingFilter = null
    }
    this._loadList(true)
  },

  onShow() {
  },

  async _loadList(reset = false) {
    if (this.data.loading) return
    if (!reset && this.data.noMore) return

    const page = reset ? 1 : this.data.page
    this.setData({ loading: true })

    try {
      const params = {
        page,
        page_size: PAGE_SIZE,
        sort: this.data.sort,
        keyword: this.data.keyword || undefined,
        ...this.data.activeFilter,
      }
      const res = await listProperties(params)
      const newList = res.list || []
      this.setData({
        list: reset ? newList : [...this.data.list, ...newList],
        page: page + 1,
        noMore: newList.length < PAGE_SIZE,
      })
    } catch (_) {}

    this.setData({ loading: false })
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value })
  },

  onSearch() {
    this._loadList(true)
  },

  onClearSearch() {
    this.setData({ keyword: '' })
    this._loadList(true)
  },

  onSortTap(e) {
    const sort = e.currentTarget.dataset.val
    this.setData({ sort })
    this._loadList(true)
  },

  onFilterTap() {
    this.setData({ showFilter: true })
  },

  onFilterClose() {
    this.setData({ showFilter: false })
  },

  onFilterConfirm(e) {
    this.setData({ showFilter: false, activeFilter: e.detail })
    this._loadList(true)
  },

  onClearFilter() {
    this.setData({ activeFilter: {} })
    this._loadList(true)
  },

  onReachBottom() {
    this._loadList(false)
  },

  onPullDownRefresh() {
    this._loadList(true).then(() => wx.stopPullDownRefresh())
  },
})

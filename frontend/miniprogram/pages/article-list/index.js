const { listArticles } = require('../../api/content')
const { fullImageURL, formatDate } = require('../../utils/format')

const PAGE_SIZE = 15

Page({
  data: {
    list: [],
    page: 1,
    loading: false,
    noMore: false,
  },

  onLoad() {
    this._load(true)
  },

  async _load(reset) {
    if (this.data.loading) return
    if (!reset && this.data.noMore) return
    const page = reset ? 1 : this.data.page
    this.setData({ loading: true })
    try {
      const res = await listArticles({ page, page_size: PAGE_SIZE })
      const items = (res.list || []).map(a => ({
        ...a,
        coverImageUrl: a.cover_image ? fullImageURL(a.cover_image) : '',
        publishedAt: formatDate(a.published_at),
      }))
      this.setData({
        list: reset ? items : [...this.data.list, ...items],
        page: page + 1,
        noMore: items.length < PAGE_SIZE,
      })
    } catch (_) {}
    this.setData({ loading: false })
  },

  onTap(e) {
    wx.navigateTo({ url: `/pages/article-detail/index?id=${e.currentTarget.dataset.id}` })
  },

  onReachBottom() { this._load(false) },
  onPullDownRefresh() { this._load(true).then(() => wx.stopPullDownRefresh()) },
})

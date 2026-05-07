const { getArticle } = require('../../api/content')
const { fullImageURL, formatDate } = require('../../utils/format')

Page({
  data: {
    article: null,
    loading: true,
    loadFailed: false,
  },

  onLoad(options) {
    this._articleId = options.id
    this._load(options.id)
  },

  onReload() {
    this.setData({ loadFailed: false, loading: true })
    this._load(this._articleId)
  },

  async _load(id) {
    this.setData({ loading: true })
    try {
      const a = await getArticle(id)
      this.setData({
        article: {
          ...a,
          coverImageUrl: a.cover_image ? fullImageURL(a.cover_image) : '',
          publishedAt: formatDate(a.published_at),
        },
        loading: false,
        loadFailed: false,
      })
      wx.setNavigationBarTitle({ title: a.title })
    } catch (_) {
      this.setData({ loading: false, loadFailed: true })
    }
  },
})

const { getArticle } = require('../../api/content')
const { fullImageURL, formatDate } = require('../../utils/format')

Page({
  data: { article: null },

  onLoad(options) {
    this._load(options.id)
  },

  async _load(id) {
    try {
      const a = await getArticle(id)
      this.setData({
        article: {
          ...a,
          coverImageUrl: a.cover_image ? fullImageURL(a.cover_image) : '',
          publishedAt: formatDate(a.published_at),
        },
      })
      wx.setNavigationBarTitle({ title: a.title })
    } catch (_) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },
})

const { listProperties } = require('../../api/property')
const { listBanners, listArticles } = require('../../api/content')
const { fullImageURL, formatDate } = require('../../utils/format')

Page({
  data: {
    banners: [],
    hotProperties: [],
    articles: [],
    loading: true,
  },

  onLoad() {
    this._loadAll()
  },

  onShow() {
  },

  async _loadAll() {
    this.setData({ loading: true })
    await Promise.all([
      this._loadBanners(),
      this._loadHotProperties(),
      this._loadArticles(),
    ])
    this.setData({ loading: false })
  },

  async _loadBanners() {
    try {
      const res = await listBanners({ position: 'home' })
      const banners = (res || []).map(b => ({
        ...b,
        imageUrl: fullImageURL(b.image_url),
      }))
      this.setData({ banners })
    } catch (_) {}
  },

  async _loadHotProperties() {
    try {
      const res = await listProperties({ page: 1, page_size: 6, sort: 'views' })
      this.setData({ hotProperties: res.list || [] })
    } catch (_) {}
  },

  async _loadArticles() {
    try {
      const res = await listArticles({ page: 1, page_size: 3 })
      const articles = (res.list || []).map(a => ({
        ...a,
        coverImageUrl: fullImageURL(a.cover_image),
        publishedAt: formatDate(a.published_at),
      }))
      this.setData({ articles })
    } catch (_) {}
  },

  onSearchTap() {
    wx.switchTab({ url: '/pages/property-list/index' })
  },

  onBannerTap(e) {
    const item = e.currentTarget.dataset.item
    if (item.link_type === 'property' && item.link_value) {
      wx.navigateTo({ url: `/pages/property-detail/index?id=${item.link_value}` })
    } else if (item.link_type === 'article' && item.link_value) {
      wx.navigateTo({ url: `/pages/article-detail/index?id=${item.link_value}` })
    }
  },

  onNavTap(e) {
    const type = e.currentTarget.dataset.type
    wx.switchTab({ url: '/pages/property-list/index' })
    // pass filter via globalData since switchTab can't carry query
    getApp().globalData.pendingFilter = { property_type: type }
  },

  onMapTap() {
    wx.switchTab({ url: '/pages/map-search/index' })
  },

  onCalcTap() {
    wx.navigateTo({ url: '/pages/loan-calculator/index' })
  },

  onMoreTap() {
    wx.switchTab({ url: '/pages/property-list/index' })
  },

  onArticleMoreTap() {
    wx.navigateTo({ url: '/pages/article-list/index' })
  },

  onArticleTap(e) {
    wx.navigateTo({ url: `/pages/article-detail/index?id=${e.currentTarget.dataset.id}` })
  },

  onPullDownRefresh() {
    this._loadAll().then(() => wx.stopPullDownRefresh())
  },
})

const { listProperties } = require('../../api/property')
const { listBanners, listArticles } = require('../../api/content')
const { fullImageURL, formatDate } = require('../../utils/format')

Page({
  data: {
    banners: [],
    hotProperties: [],
    articles: [],
    loading: true,
    _loaded: false,
  },

  onLoad() {
    this._loadAll()
  },

  // 从子页返回时刷新（onLoad 只触发一次，tab 切换靠 onShow）
  onShow() {
    if (this.data._loaded) this._loadAll()
  },

  async _loadAll() {
    this.setData({ loading: true })
    await Promise.all([
      this._loadBanners(),
      this._loadHotProperties(),
      this._loadArticles(),
    ])
    this.setData({ loading: false, _loaded: true })
  },

  async _loadBanners() {
    try {
      const res = await listBanners({ position: 'home' })
      console.log('[index] banners res:', JSON.stringify(res))
      const banners = (res || []).map(function(b) {
        return {
          id: b.id,
          image_url: b.image_url,
          link_type: b.link_type,
          link_value: b.link_value,
          imageUrl: fullImageURL(b.image_url)
        }
      })
      this.setData({ banners: banners })
    } catch (e) {
      console.error('[index] _loadBanners failed:', e)
    }
  },

  async _loadHotProperties() {
    try {
      const res = await listProperties({ page: 1, page_size: 6, sort: 'views' })
      console.log('[index] properties res:', JSON.stringify(res))
      // 兼容 res 可能是数组或带 list 字段的对象
      var list = Array.isArray(res) ? res : (res && res.list ? res.list : [])
      this.setData({ hotProperties: list })
    } catch (e) {
      console.error('[index] _loadHotProperties failed:', e)
    }
  },

  async _loadArticles() {
    try {
      const res = await listArticles({ page: 1, page_size: 3 })
      console.log('[index] articles res:', JSON.stringify(res))
      var list = Array.isArray(res) ? res : (res && res.list ? res.list : [])
      var articles = list.map(function(a) {
        return {
          id: a.id,
          title: a.title,
          cover_image: a.cover_image,
          published_at: a.published_at,
          coverImageUrl: fullImageURL(a.cover_image),
          publishedAt: formatDate(a.published_at)
        }
      })
      this.setData({ articles: articles })
    } catch (e) {
      console.error('[index] _loadArticles failed:', e)
    }
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
    getApp().globalData.pendingFilter = { type: type }
    wx.switchTab({ url: '/pages/property-list/index' })
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

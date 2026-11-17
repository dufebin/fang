const { fullImageURL, thumbURL } = require('../../utils/format')

Component({
  properties: {
    property: { type: Object, value: {} },
    agentCode: { type: String, value: '' },
    showStatus: { type: Boolean, value: false },
    compact: { type: Boolean, value: false },
    fourImages: { type: Boolean, value: false },
  },

  observers: {
    property(p) {
      const coverSrc = (p.images && p.images.length > 0)
        ? p.images[0].url
        : p.cover_image
      const quickTags = []
      if (p.video_url) quickTags.push('视频讲房')
      if (p.is_verified) quickTags.push('已核验')
      if (p.tags) {
        String(p.tags).split(',').map(s => s.trim()).filter(Boolean).slice(0, 2).forEach(tag => {
          if (quickTags.indexOf(tag) < 0) quickTags.push(tag)
        })
      }
      const imgs = p.images && p.images.length ? p.images : []
      // 拼图取实际前 4 张（2 图上下、3 图左大右二、≥4 图四宫格），不再重复补位
      const srcs = imgs.length >= 2
        ? imgs.slice(0, 4).map(img => img.url)
        : []
      const fourImgUrls = srcs.map(thumbURL)
      // 缩略图加载失败时回退原图；两者相同（如遗留绝对 URL）则不设回退
      const fourOriginals = srcs.map(u => (thumbURL(u) === fullImageURL(u) ? '' : fullImageURL(u)))
      const coverImage = thumbURL(coverSrc)
      const coverFallback = coverImage === fullImageURL(coverSrc) ? '' : fullImageURL(coverSrc)
      this.setData({ coverImage, coverFallback, quickTags: quickTags.slice(0, 3), fourImgUrls, fourOriginals })
    },
  },

  methods: {
    onCoverImgError() {
      if (this.data.coverFallback) {
        this.setData({ coverImage: this.data.coverFallback, coverFallback: '' })
      }
    },
    onGridImgError(e) {
      const i = e.currentTarget.dataset.idx
      const fb = (this.data.fourOriginals || [])[i]
      if (fb) {
        this.setData({ [`fourImgUrls[${i}]`]: fb, [`fourOriginals[${i}]`]: '' })
      }
    },
    onTap() {
      const { id } = this.properties.property
      const agentCode = this.properties.agentCode
      wx.navigateTo({
        url: `/pages/property-detail/index?id=${id}${agentCode ? '&a=' + agentCode : ''}`,
      })
    },
  },

  data: {
    coverImage: '',
    coverFallback: '',
    quickTags: [],
    fourImgUrls: [],
    fourOriginals: [],
  },
})

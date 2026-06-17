const { fullImageURL } = require('../../utils/format')

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
      const coverImage = (p.images && p.images.length > 0)
        ? fullImageURL(p.images[0].url)
        : fullImageURL(p.cover_image)
      const quickTags = []
      if (p.video_url) quickTags.push('视频讲房')
      if (p.is_verified) quickTags.push('已核验')
      if (p.tags) {
        String(p.tags).split(',').map(s => s.trim()).filter(Boolean).slice(0, 2).forEach(tag => {
          if (quickTags.indexOf(tag) < 0) quickTags.push(tag)
        })
      }
      const imgs = p.images && p.images.length ? p.images : []
      const fourImgUrls = imgs.length >= 2
        ? [0, 1, 2, 3].map(i => fullImageURL(imgs[Math.min(i, imgs.length - 1)].url))
        : []
      this.setData({ coverImage, quickTags: quickTags.slice(0, 3), fourImgUrls })
    },
  },

  methods: {
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
    quickTags: [],
    fourImgUrls: [],
  },
})

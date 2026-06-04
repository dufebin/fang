const { fullImageURL } = require('../../utils/format')

Component({
  properties: {
    property: { type: Object, value: {} },
    agentCode: { type: String, value: '' },
    showStatus: { type: Boolean, value: false },
    compact: { type: Boolean, value: false },
  },

  observers: {
    property(p) {
      const coverImage = (p.images && p.images.length > 0)
        ? fullImageURL(p.images[0].url)
        : fullImageURL(p.cover_image)
      this.setData({ coverImage })
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
  },
})

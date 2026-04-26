const { formatPrice, formatArea, formatLayout, fullImageURL, statusLabel, statusClass } = require('../../utils/format')

Component({
  properties: {
    property: { type: Object, value: {} },
    agentCode: { type: String, value: '' },
    showStatus: { type: Boolean, value: false },
  },

  computed: {},

  methods: {
    onTap() {
      const { id } = this.properties.property
      const agentCode = this.properties.agentCode
      wx.navigateTo({
        url: `/pages/property-detail/index?id=${id}${agentCode ? '&a=' + agentCode : ''}`,
      })
    },

    _formatPrice(p) {
      return formatPrice(p.total_price, p.property_type === '租房' ? 'rent' : 'sale')
    },
  },

  lifetimes: {
    attached() {
      const p = this.properties.property
      const coverImage = p.images && p.images.length > 0
        ? fullImageURL(p.images[0].url)
        : fullImageURL(p.cover_image)

      this.setData({
        coverImage,
        priceText: formatPrice(p.total_price, p.property_type === '租房' ? 'rent' : 'sale'),
        areaText: formatArea(p.area),
        layoutText: formatLayout(p.bedrooms, p.living_rooms, p.bathrooms),
        statusText: statusLabel(p.status),
        statusCls: statusClass(p.status),
      })
    },
  },

  data: {
    coverImage: '',
    priceText: '--',
    areaText: '--',
    layoutText: '--',
    statusText: '',
    statusCls: '',
  },
})

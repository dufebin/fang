const { getPropertyDetail } = require('../../api/property')
const { toggleFavorite } = require('../../api/user')
const { createAppointment } = require('../../api/appointment')
const { fullImageURL, formatPrice, formatArea, formatLayout, formatFloor } = require('../../utils/format')
const { calcEqualInstallment } = require('../../utils/loan')
const { requireLogin } = require('../../utils/auth')

Page({
  data: {
    property: null,
    agent: null,
    images: [],
    priceText: '--',
    areaText: '--',
    layoutText: '--',
    floorText: '--',
    tags: [],
    isFav: false,
    monthlyText: '--',
    swiperCurrent: 0,
    apptDate: '',
    apptTime: '',
    apptNote: '',
    agentCode: '',
  },

  onLoad(options) {
    const { id, a } = options
    this._propertyId = id
    this.setData({ agentCode: a || '' })
    this._loadDetail(id, a)
  },

  async _loadDetail(id, agentCode) {
    try {
      const property = await getPropertyDetail(id, agentCode)
      const images = (property.images && property.images.length > 0)
        ? property.images.map(img => fullImageURL(img.url))
        : [fullImageURL(property.cover_image)]

      const agent = property.agent || {}
      const tags = property.tags ? property.tags.split(',').filter(Boolean) : []
      const priceText = formatPrice(property.total_price, property.property_type === '租房' ? 'rent' : 'sale')
      const areaText = formatArea(property.area)
      const layoutText = formatLayout(property.bedrooms, property.living_rooms, property.bathrooms)
      const floorText = formatFloor(property.floor, property.total_floors)

      let monthlyText = '--'
      if (property.total_price && property.property_type !== '租房') {
        const loan = property.total_price * 10000 * 0.7
        const result = calcEqualInstallment(loan, 30, 3.95)
        const m = result.monthly
        monthlyText = m >= 10000 ? (m / 10000).toFixed(2) + '万/月' : Math.round(m) + '元/月'
      }

      this.setData({
        property,
        agent,
        images,
        priceText,
        areaText,
        layoutText,
        floorText,
        tags,
        monthlyText,
        isFav: property.is_favorited || false,
      })

      wx.setNavigationBarTitle({ title: property.title || '房源详情' })
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  onSwiperChange(e) {
    this.setData({ swiperCurrent: e.detail.current })
  },

  onPreviewImage(e) {
    const index = e.currentTarget.dataset.index
    wx.previewImage({ urls: this.data.images, current: this.data.images[index] })
  },

  async onToggleFav() {
    if (!requireLogin(this)) return
    try {
      const res = await toggleFavorite(this._propertyId)
      this.setData({ isFav: res.is_favorited })
    } catch (_) {}
  },

  onLoanCalc() {
    const p = this.data.property
    wx.navigateTo({
      url: `/pages/loan-calculator/index?price=${p.total_price}&type=${p.property_type}`,
    })
  },

  onDateChange(e) {
    this.setData({ apptDate: e.detail.value })
  },

  onTimeChange(e) {
    this.setData({ apptTime: e.detail.value })
  },

  onNoteInput(e) {
    this.setData({ apptNote: e.detail.value })
  },

  async onSubmitAppt() {
    if (!requireLogin(this)) return
    const { apptDate, apptTime, apptNote, agentCode } = this.data
    if (!apptDate || !apptTime) {
      wx.showToast({ title: '请选择预约时间', icon: 'none' })
      return
    }
    try {
      await createAppointment({
        property_id: Number(this._propertyId),
        agent_code: agentCode || undefined,
        scheduled_at: `${apptDate}T${apptTime}:00`,
        note: apptNote,
      })
      wx.showToast({ title: '预约成功' })
      this.setData({ apptDate: '', apptTime: '', apptNote: '' })
    } catch (_) {
      wx.showToast({ title: '预约失败', icon: 'none' })
    }
  },

  onShareAppMessage() {
    const p = this.data.property
    const agentCode = this.data.agentCode
    return {
      title: p.title,
      path: `/pages/property-detail/index?id=${this._propertyId}${agentCode ? '&a=' + agentCode : ''}`,
      imageUrl: this.data.images[0],
    }
  },
})

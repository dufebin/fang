const { getPropertyDetail, claimProperty, unclaimProperty } = require('../../api/property')
const { toggleFavorite, getMe } = require('../../api/user')
const { fullImageURL, formatPrice, formatArea, formatLayout, formatFloor, formatDate, timeAgo, formatPropertyType, statusLabel } = require('../../utils/format')
const { calcEqualInstallment } = require('../../utils/loan')
const { requireLogin, isLoggedIn } = require('../../utils/auth')

Page({
  data: {
    property: null,
    agent: null,
    images: [],
    mediaItems: [],
    priceText: '--',
    areaText: '--',
    layoutText: '--',
    floorText: '--',
    commissionText: '',
    tags: [],
    isFav: false,
    monthlyText: '--',
    swiperCurrent: 0,
    agentCode: '',
    isClaimed: false,
    myClaimCommission: null,
    claimCommissionInput: '',
    isOwner: false,
    canShowClaimSection: false,
    hasAgentPhone: false,
    publishDateText: '--',
    publishAgoText: '--',
    statusText: '--',
    trustSignals: [],
    unitPriceText: '--',
    locationText: '--',
    addressText: '--',
    heatText: '--',
    dealInfoList: [],
    highlightCards: [],
  },

  onLoad(options) {
    const { id, a } = options
    this._options = options
    this._propertyId = id
    this.setData({ agentCode: a || '' })
    this._loadDetail(id, a)
  },

  onReload() {
    this._loadDetail(this._propertyId, this.data.agentCode)
  },

  async _loadDetail(id, agentCode) {
    try {
      const property = await getPropertyDetail(id, agentCode)

      const imageStrings = (property.images && property.images.length > 0)
        ? property.images.map(img => fullImageURL(img.url))
        : (property.cover_image ? [fullImageURL(property.cover_image)] : [])

      const mediaItems = []
      if (property.video_url) {
        mediaItems.push({ type: 'video', url: fullImageURL(property.video_url) })
      }
      imageStrings.forEach(url => mediaItems.push({ type: 'image', url }))

      const agent = property.agent || {}
      const tags = property.tags ? property.tags.split(',').filter(Boolean) : []
      const priceText = formatPrice(property.total_price, property.property_type === 'rent' ? 'rent' : 'sale')
      const areaText = formatArea(property.area)
      const layoutText = formatLayout(property.bedrooms, property.living_rooms, property.bathrooms)
      const floorText = formatFloor(property.floor, property.total_floors)
      const rawDate = property.created_at || property.updated_at || ''
      const publishDateText = rawDate ? formatDate(String(rawDate)) : '--'
      const publishAgoText = rawDate ? timeAgo(String(rawDate)) : '--'
      const statusText = statusLabel(property.status || '')
      const unitPriceText = property.total_price && property.area
        ? Math.round((property.total_price * 10000) / property.area) + '元/㎡'
        : '--'
      const locationText = [property.city, property.district].filter(Boolean).join(' · ') || '--'
      const addressText = property.address || '暂无详细地址'
      const viewCount = Number(property.view_count || 0)
      const heatText = viewCount >= 1000 ? (viewCount / 1000).toFixed(1) + 'k人看过' : viewCount + '人看过'
      const trustSignals = []
      if (property.is_verified) trustSignals.push('官方核验')
      if (property.video_url) trustSignals.push('视频讲房')
      if (property.has_elevator) trustSignals.push('上下楼更方便')
      if (viewCount > 100) trustSignals.push('高热度房源')

      const highlightCards = [
        property.is_verified ? { label: '核验状态', value: '已核验', desc: '降低虚假房源风险' } : null,
        property.video_url ? { label: '看房方式', value: '支持视频', desc: '远程先看房更省时间' } : null,
        property.decoration ? { label: '装修情况', value: property.decoration, desc: '入住成本更直观' } : null,
        property.orientation ? { label: '房屋朝向', value: property.orientation, desc: '采光通风一眼判断' } : null,
        property.has_elevator != null ? { label: '电梯配置', value: property.has_elevator ? '有电梯' : '无电梯', desc: '日常通行体验差异明显' } : null,
        property.building_age != null ? { label: '楼龄', value: property.building_age + '年', desc: '影响贷款与居住预期' } : null,
        property.parking != null ? { label: '车位', value: property.parking + '个', desc: '停车便利度更清晰' } : null,
      ].filter(Boolean)

      // 有 agentCode 时显示该认领人佣金，否则显示录入人设定的佣金
      let commissionText = ''
      if (agentCode && agent.claim_commission != null) {
        commissionText = agent.claim_commission + ' 元'
      } else if (property.commission != null) {
        commissionText = property.commission + ' 元'
      }

      const dealInfoList = [
        { label: '区域', value: locationText },
        { label: '详细地址', value: addressText },
        { label: '房源类型', value: formatPropertyType(property.property_type) },
        { label: '交易状态', value: statusText || '--' },
        { label: '挂牌时间', value: publishDateText },
        { label: '佣金说明', value: commissionText || '暂无佣金信息' },
      ]

      let monthlyText = '--'
      if (property.total_price && property.property_type !== 'rent') {
        const loan = property.total_price * 10000 * 0.7
        const result = calcEqualInstallment(loan, 30, 3.95)
        const m = result.monthly
        monthlyText = m >= 10000 ? (m / 10000).toFixed(2) + '万/月' : Math.round(m) + '元/月'
      }

      const loggedIn = isLoggedIn()
      let currentUserId = getApp().globalData.userInfo && getApp().globalData.userInfo.user_id
      if (!currentUserId && loggedIn) {
        try {
          const me = await getMe()
          currentUserId = me.user_id
          getApp().globalData.userInfo = { ...(getApp().globalData.userInfo || {}), ...me }
        } catch (_) {}
      }

      const myAgentCode = wx.getStorageSync('agentCode') || ''
      const isOwnerByAgentCode = !!(myAgentCode && property.owner_agent_code && myAgentCode === property.owner_agent_code)
      const isOwnerByUserID = !!(currentUserId && property.created_by && Number(currentUserId) === Number(property.created_by))
      const isOwner = isOwnerByAgentCode || isOwnerByUserID
      const canShowClaimSection = loggedIn && !currentUserId ? false : !isOwner

      this.setData({
        property,
        agent,
        propertyTypeText: formatPropertyType(property.property_type),
        images: imageStrings,
        mediaItems,
        priceText,
        areaText,
        layoutText,
        floorText,
        commissionText,
        tags,
        monthlyText,
        isFav: property.is_favorited || false,
        isClaimed: property.is_claimed || false,
        myClaimCommission: property.my_claim_commission != null ? property.my_claim_commission : null,
        loadingFailed: false,
        isOwner,
        canShowClaimSection,
        hasAgentPhone: !!(agent && agent.phone),
        publishDateText,
        publishAgoText,
        statusText,
        trustSignals,
        unitPriceText,
        locationText,
        addressText,
        heatText,
        dealInfoList,
        highlightCards,
      })

      wx.setNavigationBarTitle({ title: property.title || '房源详情' })
    } catch (e) {
      this.setData({ loadingFailed: true })
    }
  },

  onSwiperChange(e) {
    this.setData({ swiperCurrent: e.detail.current })
  },

  onPreviewImage(e) {
    const index = e.currentTarget.dataset.index
    const item = this.data.mediaItems[index]
    if (!item || item.type === 'video') return
    wx.previewImage({ urls: this.data.images, current: item.url })
  },

  async onToggleFav() {
    if (!requireLogin()) return
    try {
      const res = await toggleFavorite(this._propertyId)
      this.setData({ isFav: res.favorited })
    } catch (_) {}
  },

  onEditProperty() {
    wx.navigateTo({ url: `/pages/property-edit/index?id=${this._propertyId}` })
  },

  onLoanCalc() {
    const p = this.data.property
    wx.navigateTo({
      url: `/pages/loan-calculator/index?price=${p.total_price}&type=${p.property_type}`,
    })
  },

  onConsultAgent() {
    const agentCode = (this.data.agent && this.data.agent.agent_code) || this.data.agentCode
    if (!agentCode) {
      wx.showToast({ title: '暂无经纪人信息', icon: 'none' })
      return
    }
    wx.navigateTo({ url: `/pages/agent-home/index?code=${agentCode}` })
  },

  onCallAgent() {
    if (!this.data.hasAgentPhone) return
    const phone = this.data.agent && this.data.agent.phone
    if (!phone) {
      wx.showToast({ title: '暂无联系电话', icon: 'none' })
      return
    }
    wx.makePhoneCall({ phoneNumber: String(phone) })
  },

  onClaimCommissionInput(e) {
    this.setData({ claimCommissionInput: e.detail.value })
  },

  async onClaim() {
    if (!requireLogin()) return
    if (this.data.isOwner) {
      wx.showToast({ title: '不能认领自己录入的房源', icon: 'none' })
      return
    }
    const raw = this.data.claimCommissionInput
    if (raw !== '' && (isNaN(Number(raw)) || Number(raw) < 0)) {
      wx.showToast({ title: '请输入有效的佣金金额', icon: 'none' })
      return
    }
    const commission = raw ? Number(raw) : null
    try {
      wx.showLoading({ title: '认领中...' })
      await claimProperty(this._propertyId, commission)
      wx.hideLoading()
      wx.showToast({ title: '认领成功' })
      this.setData({ isClaimed: true, myClaimCommission: commission })
    } catch (_) {
      wx.hideLoading()
      wx.showToast({ title: '认领失败', icon: 'none' })
    }
  },

  async onUnclaim() {
    try {
      await unclaimProperty(this._propertyId)
      wx.showToast({ title: '已取消认领' })
      this.setData({ isClaimed: false, myClaimCommission: null, claimCommissionInput: '' })
    } catch (_) {
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },

  onShare() {
    const agentCode = wx.getStorageSync('agentCode') || this.data.agentCode || ''
    wx.navigateTo({
      url: `/pages/property-poster/index?id=${this._propertyId}${agentCode ? '&a=' + agentCode : ''}`,
    })
  },

  onShareAppMessage() {
    const p = this.data.property
    const agentCode = wx.getStorageSync('agentCode') || this.data.agentCode
    return {
      title: p.title,
      path: `/pages/property-detail/index?id=${this._propertyId}${agentCode ? '&a=' + agentCode : ''}`,
      imageUrl: this.data.images[0] || '',
    }
  },
})

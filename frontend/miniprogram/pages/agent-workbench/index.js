const { getStats } = require('../../api/agent')
const { getMyProperties, deleteProperty, updatePropertyStatus } = require('../../api/property')
const { listAgentAppointments, updateAppointmentStatus } = require('../../api/appointment')
const { formatDate } = require('../../utils/format')

Page({
  data: {
    stats: {},
    activeTab: 'my',
    propertyList: [],
    apptList: [],
    loading: false,
  },

  // 页内 tab 数据缓存，onShow 时重置保证返回页面总拿最新数据
  _tabLoaded: {},

  onShow() {
    this._tabLoaded = {}
    this._loadStats()
    this._loadTabData(this.data.activeTab)
  },

  async _loadStats() {
    try {
      const res = await getStats()
      const stats = res || {}
      const pickNumber = (primary, fallback) => {
        if (typeof primary === 'number') return primary
        if (typeof fallback === 'number') return fallback
        return 0
      }
      this.setData({
        stats: {
          property_count: pickNumber(stats.property_count, stats.claims),
          total_views: pickNumber(stats.total_views, stats.views),
          appointment_count: pickNumber(stats.appointment_count, stats.appointments),
          favorite_count: pickNumber(stats.favorite_count),
        },
      })
    } catch (_) {}
  },

  async _loadTabData(tab) {
    if (this._tabLoaded[tab]) return
    // 请求序号：快速切换 tab 时丢弃过期响应，避免 A tab 显示 B tab 的数据
    const seq = (this._loadSeq = (this._loadSeq || 0) + 1)
    this.setData({ loading: true })
    try {
      if (tab === 'my') {
        const res = await getMyProperties({ page: 1, page_size: 20, role: 'owner' })
        if (seq !== this._loadSeq) return
        this.setData({ propertyList: res.list || [] })
      } else if (tab === 'claimed') {
        const res = await getMyProperties({ page: 1, page_size: 20, role: 'claimed' })
        if (seq !== this._loadSeq) return
        this.setData({ propertyList: res.list || [] })
      } else if (tab === 'appt') {
        const res = await listAgentAppointments({ status: 'pending' })
        if (seq !== this._loadSeq) return
        const list = (res || []).map(a => ({
          ...a,
          user_name: a.user ? (a.user.nickname || '用户') : '未知',
          property_title: a.property ? a.property.title : '未知房源',
          scheduledAt: formatDate(a.scheduled_at),
        }))
        this.setData({ apptList: list })
      }
      this._tabLoaded[tab] = true
    } catch (_) {
      if (seq !== this._loadSeq) return
      wx.showToast({ title: '加载失败，请重试', icon: 'none' })
    }
    if (seq === this._loadSeq) this.setData({ loading: false })
  },

  onTabTap(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab === this.data.activeTab) return
    // 切 tab 先清空旧列表并失效目标缓存，避免残留/串显上一个 tab 的数据
    this.setData({ activeTab: tab, propertyList: [] })
    this._tabLoaded[tab] = false
    this._loadTabData(tab)
  },

  onAddProperty() { wx.navigateTo({ url: '/pages/property-edit/index' }) },

  onEditProperty(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/property-edit/index?id=${id}` })
  },

  onDeleteProperty(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，确认删除该房源？',
      success: async res => {
        if (!res.confirm) return
        try {
          await deleteProperty(id)
          wx.showToast({ title: '已删除' })
          const tab = this.data.activeTab
          this._tabLoaded[tab] = false
          this._loadTabData(tab)
        } catch (_) {
          wx.showToast({ title: '删除失败', icon: 'none' })
        }
      },
    })
  },
  async onStatusTap(e) {
    const id = e.currentTarget.dataset.id
    const val = e.currentTarget.dataset.val
    if (!id || !val) return
    try {
      await updatePropertyStatus(id, val)
      wx.showToast({ title: '状态已更新' })
      const tab = this.data.activeTab
      this._tabLoaded[tab] = false
      this._loadTabData(tab)
    } catch (err) {
      const msg = (err && (err.message || err.errMsg)) || '操作失败'
      wx.showToast({ title: typeof msg === 'string' && msg.length <= 14 ? msg : '操作失败', icon: 'none' })
    }
  },

  onViewAppointments() { this.onTabTap({ currentTarget: { dataset: { tab: 'appt' } } }) },
  onEditProfile() { wx.navigateTo({ url: '/pages/agent-profile/index' }) },
  onSharePoster() { wx.navigateTo({ url: '/pages/agent-poster/index' }) },

  async onConfirmAppt(e) {
    const id = e.currentTarget.dataset.id
    try {
      await updateAppointmentStatus(id, 'confirmed')
      this._tabLoaded['appt'] = false
      this._loadTabData('appt')
    } catch (_) { wx.showToast({ title: '操作失败', icon: 'none' }) }
  },

  async onRejectAppt(e) {
    const id = e.currentTarget.dataset.id
    try {
      await updateAppointmentStatus(id, 'cancelled')
      this._tabLoaded['appt'] = false
      this._loadTabData('appt')
    } catch (_) { wx.showToast({ title: '操作失败', icon: 'none' }) }
  },
})

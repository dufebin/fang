const { getStats } = require('../../api/agent')
const { getMyProperties } = require('../../api/property')
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

  onShow() {
    this._loadStats()
    this._loadTabData('my')
  },

  async _loadStats() {
    try {
      const res = await getStats()
      this.setData({ stats: res || {} })
    } catch (_) {}
  },

  async _loadTabData(tab) {
    this.setData({ loading: true })
    try {
      if (tab === 'my') {
        const res = await getMyProperties({ page: 1, page_size: 20, role: 'owner' })
        this.setData({ propertyList: res.list || [] })
      } else if (tab === 'claimed') {
        const res = await getMyProperties({ page: 1, page_size: 20, role: 'claimed' })
        this.setData({ propertyList: res.list || [] })
      } else if (tab === 'appt') {
        const res = await listAgentAppointments({ status: 'pending' })
        const list = (res || []).map(a => ({
          ...a,
          user_name: a.user ? (a.user.nickname || '用户') : '未知',
          property_title: a.property ? a.property.title : '未知房源',
          scheduledAt: formatDate(a.scheduled_at),
        }))
        this.setData({ apptList: list })
      }
    } catch (_) {}
    this.setData({ loading: false })
  },

  onTabTap(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
    this._loadTabData(tab)
  },

  onAddProperty() { wx.navigateTo({ url: '/pages/property-edit/index' }) },
  onViewAppointments() { this.onTabTap({ currentTarget: { dataset: { tab: 'appt' } } }) },
  onEditProfile() { wx.navigateTo({ url: '/pages/agent-profile/index' }) },
  onSharePoster() { wx.navigateTo({ url: '/pages/agent-poster/index' }) },

  async onConfirmAppt(e) {
    const id = e.currentTarget.dataset.id
    try {
      await updateAppointmentStatus(id, 'confirmed')
      this._loadTabData('appt')
    } catch (_) { wx.showToast({ title: '操作失败', icon: 'none' }) }
  },

  async onRejectAppt(e) {
    const id = e.currentTarget.dataset.id
    try {
      await updateAppointmentStatus(id, 'cancelled')
      this._loadTabData('appt')
    } catch (_) { wx.showToast({ title: '操作失败', icon: 'none' }) }
  },
})

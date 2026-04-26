const { listMyAppointments, cancelAppointment } = require('../../api/appointment')
const { formatDate } = require('../../utils/format')

const STATUS_MAP = { pending: '待确认', confirmed: '已确认', cancelled: '已取消', completed: '已完成' }

Page({
  data: { list: [], loading: false },

  onLoad() { this._load() },
  onPullDownRefresh() { this._load().then(() => wx.stopPullDownRefresh()) },

  async _load() {
    this.setData({ loading: true })
    try {
      const res = await listMyAppointments()
      const list = (res || []).map(a => ({
        ...a,
        property_title: a.property ? a.property.title : '未知房源',
        scheduledAt: formatDate(a.scheduled_at),
        statusText: STATUS_MAP[a.status] || a.status,
      }))
      this.setData({ list })
    } catch (_) {}
    this.setData({ loading: false })
  },

  async onCancel(e) {
    const id = e.currentTarget.dataset.id
    const res = await wx.showModal({ title: '确认取消', content: '确定取消本次预约？' })
    if (!res.confirm) return
    try {
      await cancelAppointment(id)
      this._load()
    } catch (_) {
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },

  onFindHouse() {
    wx.switchTab({ url: '/pages/property-list/index' })
  },
})

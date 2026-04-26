const { listNotifications, markRead, markAllRead } = require('../../api/user')
const { formatDate } = require('../../utils/format')

Page({
  data: { list: [], loading: false },

  onLoad() { this._load() },
  onPullDownRefresh() { this._load().then(() => wx.stopPullDownRefresh()) },

  async _load() {
    this.setData({ loading: true })
    try {
      const res = await listNotifications()
      const list = (res || []).map(n => ({ ...n, createdAt: formatDate(n.created_at) }))
      this.setData({ list })
    } catch (_) {}
    this.setData({ loading: false })
  },

  async onRead(e) {
    const id = e.currentTarget.dataset.id
    try {
      await markRead(id)
      const list = this.data.list.map(n => n.id === id ? { ...n, is_read: true } : n)
      this.setData({ list })
    } catch (_) {}
  },

  async onReadAll() {
    try {
      await markAllRead()
      const list = this.data.list.map(n => ({ ...n, is_read: true }))
      this.setData({ list })
    } catch (_) {}
  },
})

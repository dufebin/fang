const { getConversations, getContacts, deleteConversation } = require('../../api/chat')

function formatTime(isoStr) {
  if (!isoStr) return ''
  var d = new Date(isoStr)
  var now = new Date()
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  var msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  if (msgDay.getTime() === today.getTime()) {
    return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0')
  }
  return (d.getMonth() + 1) + '/' + d.getDate()
}

Page({
  _pressTimer: null,
  _isLongPress: false,

  data: {
    list: [],
    contacts: [],
    showContacts: false,
    loading: true,
    cleanMode: false,
    privacyMasked: false,
  },

  onLoad(options) {
    if (options && options.clean === '1') {
      this.setData({ cleanMode: true, loading: false })
    }
  },

  onShow() {
    this.setData({ privacyMasked: false })
    if (this.data.cleanMode) return
    this._loadList()
  },

  onHide() {
    this.setData({ privacyMasked: true })
  },

  async _loadList() {
    try {
      const data = await getConversations()
      const list = (Array.isArray(data) ? data : []).map(function(item) {
        return Object.assign({}, item, { last_at_fmt: formatTime(item.last_at) })
      })
      this.setData({ list: list, loading: false })
    } catch (_) {
      this.setData({ loading: false })
    }
  },

  onOpenChat(e) {
    if (this._isLongPress) {
      this._isLongPress = false
      return
    }
    const { peerId, peerName, peerAvatar } = e.currentTarget.dataset
    wx.navigateTo({ url: '/pages/chat/index?peer_id=' + peerId + '&peer_name=' + encodeURIComponent(peerName || '用户') + '&peer_avatar=' + encodeURIComponent(peerAvatar || '') })
  },

  async onNewChat() {
    if (this.data.cleanMode) return
    try {
      const data = await getContacts()
      this.setData({ contacts: Array.isArray(data) ? data : [], showContacts: true })
    } catch (_) {
      this.setData({ contacts: [], showContacts: true })
    }
  },

  onSelectContact(e) {
    const { id, name, avatar } = e.currentTarget.dataset
    this.setData({ showContacts: false })
    wx.navigateTo({ url: '/pages/chat/index?peer_id=' + id + '&peer_name=' + encodeURIComponent(name || '用户') + '&peer_avatar=' + encodeURIComponent(avatar || '') })
  },

  onCloseContacts() {
    this.setData({ showContacts: false })
  },

  onConvTouchStart(e) {
    const peerId = e.currentTarget.dataset.peerId
    this._isLongPress = false
    this._pressTimer = setTimeout(() => {
      this._pressTimer = null
      this._isLongPress = true
      wx.showActionSheet({
        itemList: ['删除会话'],
        success: (res) => {
          if (res.tapIndex === 0) {
            deleteConversation(peerId).then(() => {
              this.setData({ list: this.data.list.filter(item => item.peer_id != peerId) })
            }).catch(function() {})
          }
        }
      })
    }, 500)
  },

  onConvTouchEnd() {
    if (this._pressTimer) {
      clearTimeout(this._pressTimer)
      this._pressTimer = null
    }
  },
})

const { getMessages, sendMessage, markRead, deleteMessage } = require('../../api/chat')

function formatTime(isoStr) {
  if (!isoStr) return ''
  var d = new Date(isoStr)
  return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0')
}

Page({
  data: {
    peerId: 0,
    peerName: '',
    myId: 0,
    messages: [],
    inputText: '',
    scrollTo: '',
  },

  _pollTimer: null,

  onLoad(options) {
    const peerId = parseInt(options.peer_id) || 0
    const peerName = decodeURIComponent(options.peer_name || '用户')
    const app = getApp()
    const myId = app.globalData.userInfo ? app.globalData.userInfo.id : 0
    this.setData({ peerId: peerId, peerName: peerName, myId: myId })
    wx.setNavigationBarTitle({ title: peerName })
    this._loadMessages()
  },

  onShow() {
    if (this.data.peerId) {
      this._startPoll()
    }
  },

  onHide() {
    this._stopPoll()
  },

  onUnload() {
    this._stopPoll()
    if (this.data.peerId) {
      markRead(this.data.peerId).catch(function() {})
    }
  },

  async _loadMessages() {
    try {
      const data = await getMessages(this.data.peerId, 1)
      const msgs = (Array.isArray(data) ? data : []).map(function(m) {
        return Object.assign({}, m, { time_fmt: formatTime(m.created_at) })
      })
      this.setData({ messages: msgs })
      this._scrollToBottom()
    } catch (_) {}
  },

  _startPoll() {
    if (this._pollTimer) return
    this._pollTimer = setInterval(() => {
      this._pollMessages()
    }, 3000)
  },

  _stopPoll() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer)
      this._pollTimer = null
    }
  },

  async _pollMessages() {
    try {
      const data = await getMessages(this.data.peerId, 1)
      const msgs = (Array.isArray(data) ? data : []).map(function(m) {
        return Object.assign({}, m, { time_fmt: formatTime(m.created_at) })
      })
      const current = this.data.messages
      if (msgs.length !== current.length || (msgs.length > 0 && msgs[msgs.length - 1].id !== current[current.length - 1].id)) {
        this.setData({ messages: msgs })
        this._scrollToBottom()
      }
    } catch (_) {}
  },

  _scrollToBottom() {
    const msgs = this.data.messages
    if (msgs.length === 0) return
    this.setData({ scrollTo: 'msg-' + msgs[msgs.length - 1].id })
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value })
  },

  _pressTimer: null,

  onBubbleTouchStart(e) {
    const msgId = e.currentTarget.dataset.id
    this._pressTimer = setTimeout(() => {
      this._pressTimer = null
      wx.showActionSheet({
        itemList: ['删除'],
        success: (res) => {
          if (res.tapIndex === 0) {
            deleteMessage(msgId).then(() => {
              this.setData({ messages: this.data.messages.filter(m => m.id != msgId) })
            }).catch(function() {})
          }
        }
      })
    }, 500)
  },

  onBubbleTouchEnd() {
    if (this._pressTimer) {
      clearTimeout(this._pressTimer)
      this._pressTimer = null
    }
  },

  async onSend() {
    const text = this.data.inputText.trim()
    if (!text) return
    this.setData({ inputText: '' })
    try {
      const msg = await sendMessage(this.data.peerId, text)
      const newMsg = Object.assign({}, msg, { time_fmt: formatTime(msg.created_at) })
      const msgs = this.data.messages.concat([newMsg])
      this.setData({ messages: msgs })
      this._scrollToBottom()
    } catch (_) {}
  },
})

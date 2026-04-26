const { getAgentHome } = require('../../api/agent')
const { listProperties } = require('../../api/property')

const PAGE_SIZE = 10

Page({
  data: {
    agent: null,
    agentCode: '',
    list: [],
    total: 0,
    page: 1,
    loading: false,
    noMore: false,
  },

  onLoad(options) {
    const code = options.code || ''
    this.setData({ agentCode: code })
    this._loadAgent(code)
    this._loadProperties(code, true)
  },

  async _loadAgent(code) {
    try {
      const res = await getAgentHome(code)
      this.setData({ agent: res.agent || res })
    } catch (_) {}
  },

  async _loadProperties(code, reset) {
    if (this.data.loading || (!reset && this.data.noMore)) return
    const page = reset ? 1 : this.data.page
    this.setData({ loading: true })
    try {
      const res = await listProperties({ agent_code: code, page, page_size: PAGE_SIZE })
      const items = res.list || []
      this.setData({
        list: reset ? items : [...this.data.list, ...items],
        total: res.total || 0,
        page: page + 1,
        noMore: items.length < PAGE_SIZE,
      })
    } catch (_) {}
    this.setData({ loading: false })
  },

  onReachBottom() {
    this._loadProperties(this.data.agentCode, false)
  },
})

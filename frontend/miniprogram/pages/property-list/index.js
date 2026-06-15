const { listProperties, getHotDistricts } = require('../../api/property')

const PAGE_SIZE = 10
const FILTER_LABELS = {
  type: '类型',
  district: '区域',
  bedrooms: '户型',
  min_price: '最低总价',
  max_price: '最高总价',
  min_area: '最小面积',
  max_area: '最大面积',
  status: '状态',
}
const TYPE_LABELS = {
  second_hand: '二手房',
  new_home: '新房',
  rent: '租房',
  decoration: '装修',
  commercial: '商铺办公',
}

Page({
  data: {
    list: [],
    page: 1,
    loading: false,
    noMore: false,
    _firstLoaded: false,
    keyword: '',
    sort: 'created_at',
    showFilter: false,
    activeFilter: {},
    filterChips: [],
    quickDistricts: [],
    activeDistrict: '',
    sortOptions: [
      { label: '最新', value: 'created_at' },
      { label: '价格低', value: 'price_asc' },
      { label: '价格高', value: 'price_desc' },
      { label: '面积', value: 'area' },
    ],
  },

  onLoad() {
    this._applyPendingFilter()
    this._loadList(true)
  },

  onShow() {
    // tab 页重复切换时 onLoad 不再触发，在此消费 pendingFilter
    if (this.data._firstLoaded) {
      this._applyPendingFilter()
    }
  },

  _applyPendingFilter() {
    const app = getApp()
    if (app.globalData.pendingFilter) {
      this.setData({ activeFilter: app.globalData.pendingFilter })
      app.globalData.pendingFilter = null
      this._rebuildFilterChips()
      if (this.data._firstLoaded) {
        this._loadList(true)
      }
    }
  },

  async _loadList(reset = false) {
    if (this.data.loading) return
    if (!reset && this.data.noMore) return

    const page = reset ? 1 : this.data.page
    this.setData({ loading: true })

    try {
      const params = {
        page,
        page_size: PAGE_SIZE,
        sort: this.data.sort,
        keyword: this.data.keyword || undefined,
        ...this.data.activeFilter,
      }
      const res = await listProperties(params)
      const newList = res.list || []
      if (reset) {
        this._loadHotDistricts()
        if (!this.data.quickDistricts.length) {
          this._buildQuickDistricts(newList)
        }
      }
      this.setData({
        list: reset ? newList : [...this.data.list, ...newList],
        page: page + 1,
        noMore: newList.length < PAGE_SIZE,
        _firstLoaded: true,
      })
    } catch (_) {
      wx.showToast({ title: '加载失败，请下拉刷新', icon: 'none' })
    }

    this.setData({ loading: false })
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value })
  },

  onSearch() {
    this._rebuildFilterChips()
    this._loadList(true)
  },

  onClearSearch() {
    this.setData({ keyword: '' })
    this._rebuildFilterChips()
    this._loadList(true)
  },

  onSortTap(e) {
    const sort = e.currentTarget.dataset.val
    this.setData({ sort })
    this._loadList(true)
  },

  onQuickDistrictTap(e) {
    const district = e.currentTarget.dataset.district || ''
    const activeFilter = { ...this.data.activeFilter }
    if (district) {
      activeFilter.district = district
    } else {
      delete activeFilter.district
    }
    this.setData({
      activeDistrict: district,
      activeFilter,
    })
    this._rebuildFilterChips()
    this._loadList(true)
  },

  onFilterTap() {
    this.setData({ showFilter: true })
  },

  onFilterClose() {
    this.setData({ showFilter: false })
  },

  onFilterConfirm(e) {
    this.setData({ showFilter: false, activeFilter: e.detail })
    this._rebuildFilterChips()
    this._loadList(true)
  },

  onClearFilter() {
    this.setData({ activeFilter: {} })
    this._rebuildFilterChips()
    this._loadList(true)
  },

  onRemoveFilterChip(e) {
    const key = e.currentTarget.dataset.key
    if (!key) return
    if (key === 'keyword') {
      this.setData({ keyword: '' })
      this._rebuildFilterChips()
      this._loadList(true)
      return
    }
    const activeFilter = { ...this.data.activeFilter }
    delete activeFilter[key]
    const nextState = { activeFilter }
    if (key === 'district') {
      nextState.activeDistrict = ''
    }
    this.setData(nextState)
    this._rebuildFilterChips()
    this._loadList(true)
  },

  _rebuildFilterChips() {
    const chips = []
    if (this.data.keyword) {
      chips.push({ key: 'keyword', label: `关键词: ${this.data.keyword}` })
    }
    Object.keys(this.data.activeFilter || {}).forEach((key) => {
      const val = this.data.activeFilter[key]
      if (val === undefined || val === null || val === '') return
      const label = FILTER_LABELS[key] || key
      let valueText = String(val)
      if (key === 'type') {
        valueText = TYPE_LABELS[val] || valueText
      } else if (key === 'bedrooms') {
        valueText = `${valueText}居`
      } else if (key === 'min_price' || key === 'max_price') {
        valueText = `${valueText}万`
      } else if (key === 'min_area' || key === 'max_area') {
        valueText = `${valueText}㎡`
      }
      chips.push({ key, label: `${label}: ${valueText}` })
    })
    this.setData({ filterChips: chips })
  },

  _buildQuickDistricts(list) {
    const countMap = {}
    ;(list || []).forEach((item) => {
      const d = item && item.district ? String(item.district).trim() : ''
      if (!d) return
      countMap[d] = (countMap[d] || 0) + 1
    })
    const quickDistricts = Object.keys(countMap)
      .sort((a, b) => countMap[b] - countMap[a])
      .slice(0, 6)
    const activeDistrict = this.data.activeFilter && this.data.activeFilter.district
      ? this.data.activeFilter.district
      : ''
    this.setData({ quickDistricts, activeDistrict })
  },

  async _loadHotDistricts() {
    try {
      const params = {
        limit: 8,
        type: this.data.activeFilter.type || undefined,
        keyword: this.data.keyword || undefined,
        status: this.data.activeFilter.status || undefined,
      }
      const rows = await getHotDistricts(params)
      const quickDistricts = (rows || [])
        .map(row => row && row.district)
        .filter(Boolean)
      const activeDistrict = this.data.activeFilter && this.data.activeFilter.district
        ? this.data.activeFilter.district
        : ''
      this.setData({ quickDistricts, activeDistrict })
    } catch (_) {
      // 热门区域加载失败时，不影响列表主流程
    }
  },

  onReachBottom() {
    this._loadList(false)
  },

  onPullDownRefresh() {
    this._loadList(true).then(() => wx.stopPullDownRefresh())
  },
})

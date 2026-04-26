const { getNearbyProperties } = require('../../api/property')

const DEFAULT_LAT = 39.9087
const DEFAULT_LNG = 116.3974
const MARKER_ICON = '/assets/icons/marker.png'

Page({
  data: {
    center: { lat: DEFAULT_LAT, lng: DEFAULT_LNG },
    scale: 14,
    markers: [],
    selectedProperty: null,
    showFilter: false,
    activeFilter: {},
    hasFilter: false,
  },

  _debounceTimer: null,

  onLoad() {
    this._locate()
  },

  onShow() {
    if (typeof this.getTabBar === 'function') {
      this.getTabBar().setData({ selected: 2 })
    }
  },

  _locate() {
    wx.getLocation({
      type: 'gcj02',
      success: res => {
        this.setData({ center: { lat: res.latitude, lng: res.longitude } })
        this._loadMarkers(res.latitude, res.longitude)
      },
      fail: () => {
        this._loadMarkers(DEFAULT_LAT, DEFAULT_LNG)
      },
    })
  },

  async _loadMarkers(lat, lng) {
    try {
      const params = {
        latitude: lat,
        longitude: lng,
        radius: 5000,
        page_size: 50,
        ...this.data.activeFilter,
      }
      const res = await getNearbyProperties(params)
      const markers = (res.list || [])
        .filter(p => p.latitude && p.longitude)
        .map(p => ({
          id: p.id,
          latitude: p.latitude,
          longitude: p.longitude,
          iconPath: MARKER_ICON,
          width: 36,
          height: 36,
          callout: {
            content: this._shortPrice(p),
            color: '#fff',
            bgColor: '#E84040',
            fontSize: 12,
            borderRadius: 4,
            padding: 4,
            display: 'BYCLICK',
          },
          _data: p,
        }))
      this.setData({ markers, _propertyMap: this._buildMap(res.list || []) })
    } catch (_) {}
  },

  _shortPrice(p) {
    const v = p.total_price
    if (!v) return '--'
    if (p.property_type === '租房') return v + '元/月'
    return v >= 10000 ? (v / 10000).toFixed(0) + '亿' : v + '万'
  },

  _buildMap(list) {
    return list.reduce((m, p) => { m[p.id] = p; return m }, {})
  },

  onMarkerTap(e) {
    const id = e.markerId
    const map = this.data._propertyMap || {}
    const p = map[id]
    if (p) this.setData({ selectedProperty: p })
  },

  onClosePanel() {
    this.setData({ selectedProperty: null })
  },

  onRegionChange(e) {
    if (e.type !== 'end') return
    clearTimeout(this._debounceTimer)
    this._debounceTimer = setTimeout(() => {
      const ctx = wx.createMapContext('propertyMap')
      ctx.getCenterLocation({
        success: res => {
          this._loadMarkers(res.latitude, res.longitude)
        },
      })
    }, 800)
  },

  onLocate() {
    this._locate()
  },

  onFilterTap() {
    this.setData({ showFilter: true })
  },

  onFilterClose() {
    this.setData({ showFilter: false })
  },

  onFilterConfirm(e) {
    const filter = e.detail
    const hasFilter = Object.keys(filter).length > 0
    this.setData({ showFilter: false, activeFilter: filter, hasFilter })
    const c = this.data.center
    this._loadMarkers(c.lat, c.lng)
  },
})

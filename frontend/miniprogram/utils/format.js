const { UPLOAD_BASE } = require('./config')

// 价格格式化
function formatPrice(price, type) {
  if (!price && price !== 0) return '--'
  if (type === 'rent') {
    return price.toFixed(0) + '元/月'
  }
  if (price >= 10000) {
    return (price / 10000).toFixed(2) + '亿'
  }
  return price.toFixed(0) + '万'
}

// 单价格式化
function formatUnitPrice(price) {
  if (!price) return '--'
  return price.toFixed(0) + '元/㎡'
}

// 面积格式化
function formatArea(area) {
  if (!area) return '--'
  return area.toFixed(2) + '㎡'
}

// 户型格式化
function formatLayout(bedrooms, livingRooms, bathrooms) {
  return `${bedrooms || 0}室${livingRooms || 0}厅${bathrooms || 0}卫`
}

// 楼层格式化
function formatFloor(floor, totalFloors) {
  if (!floor) return '--'
  const level = floor <= 3 ? '低层' : floor <= Math.ceil(totalFloors / 2) ? '中层' : '高层'
  return `${level} ${floor}/${totalFloors || '--'}层`
}

// 图片 URL 补全
function fullImageURL(url) {
  if (!url) return ''
  if (url.startsWith('http')) return url
  return UPLOAD_BASE + url
}

// 日期格式化 2024-01-15
function formatDate(dateStr) {
  if (!dateStr) return '--'
  return dateStr.replace('T', ' ').slice(0, 10)
}

// 相对时间（几分钟前）
function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return m + '分钟前'
  const h = Math.floor(m / 60)
  if (h < 24) return h + '小时前'
  const d = Math.floor(h / 24)
  if (d < 30) return d + '天前'
  return formatDate(dateStr)
}

// 房源状态文字
function statusLabel(status) {
  const map = {
    available: '在售',
    sold: '已售',
    rented: '已租',
    offline: '已下架',
  }
  return map[status] || status
}

// 房源状态颜色 class
function statusClass(status) {
  const map = {
    available: 'tag-green',
    sold: 'tag-gray',
    rented: 'tag-blue',
    offline: 'tag-gray',
  }
  return map[status] || 'tag-gray'
}

module.exports = {
  formatPrice,
  formatUnitPrice,
  formatArea,
  formatLayout,
  formatFloor,
  fullImageURL,
  formatDate,
  timeAgo,
  statusLabel,
  statusClass,
}

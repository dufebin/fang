import type { PropertyStatus, PropertyType } from '../api/property'

export function formatPrice(price: number | null, type: PropertyType) {
  if (price == null) return '价格面议'
  if (type === 'rent') return `${price.toFixed(0)}元/月`
  if (price >= 10000) return `${(price / 10000).toFixed(2)}亿`
  return `${price.toFixed(0)}万`
}

export function formatUnitPrice(price: number | null) {
  return price == null ? '—' : `${price.toFixed(0)}元/㎡`
}

export function formatArea(area: number | null) {
  return area == null ? '—' : `${area.toFixed(2)}㎡`
}

export function formatLayout(bedrooms: number, livingRooms: number, bathrooms: number) {
  return `${bedrooms || 0}室${livingRooms || 0}厅${bathrooms || 0}卫`
}

export function formatFloor(floor: number | null, totalFloors: number | null) {
  if (floor == null) return '—'
  if (totalFloors == null || totalFloors <= 0) return `${floor}层`
  const level = floor <= 3 ? '低层' : floor <= Math.ceil(totalFloors / 2) ? '中层' : '高层'
  return `${level} ${floor}/${totalFloors}层`
}

export function formatPropertyType(type: PropertyType) {
  const map: Record<PropertyType, string> = {
    second_hand: '二手房',
    new_home: '新房',
    rent: '租房',
    decoration: '装修',
    commercial: '商铺办公',
  }
  return map[type] || '—'
}

export function formatPropertyStatus(status: PropertyStatus) {
  const map: Record<PropertyStatus, string> = {
    available: '在售',
    sold: '已售',
    rented: '已租',
    offline: '已下架',
  }
  return map[status] || '未知'
}

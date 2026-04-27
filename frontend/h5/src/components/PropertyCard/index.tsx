import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Property } from '../../api/property'
import styles from './index.module.css'

interface Props {
  property: Property
  agentCode?: string
}

export default function PropertyCard({ property, agentCode }: Props) {
  const navigate = useNavigate()

  const priceText = property.property_type === '租房'
    ? property.monthly_rent ? `${property.monthly_rent}元/月` : '价格面议'
    : property.total_price ? `${property.total_price}万` : '价格面议'

  const roomInfo = `${property.bedrooms}室${property.living_rooms}厅`

  const handleClick = () => {
    const path = agentCode
      ? `/p/${property.id}?a=${agentCode}`
      : `/p/${property.id}`
    navigate(path)
  }

  return (
    <div className={styles.card} onClick={handleClick}>
      {/* 暂时不显示图片，排除图片加载问题 */}
      <div style={{ padding: '10px', borderBottom: '1px solid #eee' }}>
        <div className={styles.title}>{property.title}</div>
        <div className={styles.tags}>
          <span className={styles.tag}>{property.property_type}</span>
          <span className={styles.tag}>{roomInfo}</span>
          <span className={styles.tag}>{property.area}㎡</span>
          {property.district && <span className={styles.tag}>{property.district}</span>}
        </div>
        <div className={styles.footer}>
          <span className={styles.price}>{priceText}</span>
          {property.unit_price && (
            <span className={styles.unitPrice}>{property.unit_price}元/㎡</span>
          )}
        </div>
      </div>
    </div>
  )
}

import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Property } from '../../api/property'
import { getImageUrl } from '../../utils/image'
import { formatPrice, formatPropertyType } from '../../utils/format'
import styles from './index.module.css'

interface Props {
  property: Property
  agentCode?: string
}

export default function PropertyCard({ property, agentCode }: Props) {
  const navigate = useNavigate()

  const price = property.property_type === 'rent' ? property.monthly_rent : property.total_price
  const priceText = formatPrice(price, property.property_type)
  const roomInfo = `${property.bedrooms}室${property.living_rooms}厅`

  const handleClick = () => {
    const path = agentCode
      ? `/p/${property.id}?a=${agentCode}`
      : `/p/${property.id}`
    navigate(path)
  }

  return (
    <div className={styles.card} onClick={handleClick}>
      <div className={styles.imageWrap}>
        {property.cover_image ? (
          <img
            src={getImageUrl(property.cover_image)}
            alt={property.title}
            className={styles.image}
            loading="lazy"
          />
        ) : (
          <div className={styles.imagePlaceholder} />
        )}
        <span className={styles.typeBadge}>{formatPropertyType(property.property_type)}</span>
      </div>
      <div className={styles.content}>
        <div className={styles.title}>{property.title}</div>
        <div className={styles.tags}>
          <span className={styles.tag}>{roomInfo}</span>
          <span className={styles.tag}>{property.area}㎡</span>
          {property.district && <span className={styles.tag}>{property.district}</span>}
        </div>
        <div className={styles.footer}>
          <div className={styles.priceWrap}>
            <span className={styles.price}>{priceText}</span>
            {property.unit_price && (
              <span className={styles.unitPrice}>{property.unit_price}元/㎡</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

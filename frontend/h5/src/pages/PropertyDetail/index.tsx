import React, { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { NavBar, Tag, Divider, Toast, Button } from 'antd-mobile'
import { MapPin } from 'lucide-react'
import ImageGallery from '../../components/ImageGallery'
import AgentCard from '../../components/AgentCard'
import { getPropertyDetail, claimProperty, unclaimProperty, Property } from '../../api/property'
import { useAuthStore } from '../../store/auth'
import styles from './index.module.css'

const statusMap: Record<string, { text: string; color: string }> = {
  available: { text: '在售', color: 'success' },
  sold: { text: '已售', color: 'default' },
  rented: { text: '已租', color: 'default' },
  offline: { text: '已下架', color: 'default' },
}

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const agentCode = searchParams.get('a') || ''
  
  const isAgent = useAuthStore(state => state.isAgent())
  const [property, setProperty] = useState<Property | null>(null)
  const [loading, setLoading] = useState(true)
  const [claimed, setClaimed] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getPropertyDetail(Number(id), agentCode || undefined)
      .then(d => {
        if (d.code === 0 && d.data) {
          setProperty(d.data)
        } else {
          setProperty(null)
        }
      })
      .catch(() => setProperty(null))
      .finally(() => setLoading(false))
  }, [id, agentCode])

  const handleClaim = async () => {
    if (!id) return
    try {
      await claimProperty(Number(id))
      setClaimed(true)
      Toast.show({ content: '认领成功！现在分享给客户吧', icon: 'success' })
    } catch {
      Toast.show({ content: '认领失败，请重试', icon: 'fail' })
    }
  }

  const handleUnclaim = async () => {
    if (!id) return
    try {
      await unclaimProperty(Number(id))
      setClaimed(false)
      Toast.show({ content: '已取消认领', icon: 'success' })
    } catch {
      Toast.show({ content: '操作失败', icon: 'fail' })
    }
  }

  const getShareLink = () => {
    return window.location.origin + `/p/${id}?a=${agentCode || ''}`
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(getShareLink())
    Toast.show({ content: '链接已复制，快去分享吧！', icon: 'success' })
  }

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.skeleton} />
        <div className={styles.skeletonText} />
        <div className={styles.skeletonText} />
      </div>
    )
  }

  if (!property) {
    return <div className={styles.empty}>房源不存在或已下架</div>
  }

  const statusInfo = statusMap[property.status] || { text: '未知', color: 'default' }
  
  const priceText = property.property_type === '租房'
    ? property.monthly_rent ? `${property.monthly_rent}元/月` : '价格面议'
    : property.total_price ? `${property.total_price}万` : '价格面议'

  return (
    <div className={styles.page}>
      <NavBar onBack={() => window.history.back()} className={styles.nav}>
        {property.title}
      </NavBar>

      <ImageGallery images={property.images || []} coverImage={property.cover_image} />

      <div className={styles.body}>
        {/* 核心信息 */}
        <div className={styles.priceSection}>
          <span className={styles.price}>{priceText}</span>
          <Tag color={statusInfo.color as 'success' | 'default'} className={styles.statusTag}>
            {statusInfo.text}
          </Tag>
        </div>
        <div className={styles.title}>{property.title}</div>

        {/* 基本信息 */}
        <div className={styles.infoGrid}>
          <InfoItem label="户型" value={`${property.bedrooms}室${property.living_rooms}厅${property.bathrooms}卫`} />
          <InfoItem label="面积" value={`${property.area}㎡`} />
          {property.floor != null && property.total_floors != null && (
            <InfoItem label="楼层" value={`${property.floor}/${property.total_floors}层`} />
          )}
          <InfoItem label="朝向" value={property.direction || '—'} />
          <InfoItem label="装修" value={property.decoration || '—'} />
          {property.unit_price && (
            <InfoItem label="单价" value={`${property.unit_price}元/㎡`} />
          )}
        </div>

        <Divider />

        {/* 地址 */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>房源位置</div>
          <div className={styles.address}>
            <MapPin size={14} style={{ verticalAlign: 'middle', marginRight: 4, flexShrink: 0 }} />
            {[property.city, property.district, property.address].filter(Boolean).join(' ')}
          </div>
        </div>

        {/* 描述 */}
        {property.description && (
          <>
            <Divider />
            <div className={styles.section}>
              <div className={styles.sectionTitle}>房源详情</div>
              <div className={styles.description}>{property.description}</div>
            </div>
          </>
        )}

        <Divider />

        {/* 经纪人名片 */}
        {property.agent ? (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>联系经纪人</div>
            <AgentCard agent={property.agent} />
          </div>
        ) : (
          <div className={styles.section}>
            <div className={styles.noAgent}>暂无专属顾问，请扫描公众号二维码联系我们</div>
          </div>
        )}

        {/* 销售员操作区：仅登录的销售员/管理员可见 */}
        {isAgent && (
          <div className={styles.agentActions}>
            <Divider />
            <div className={styles.sectionTitle}>销售员操作</div>
            <div className={styles.actionBtns}>
              {claimed ? (
                <Button color="default" fill="outline" onClick={handleUnclaim} className={styles.actionBtn}>
                  取消认领
                </Button>
              ) : (
                <Button color="primary" onClick={handleClaim} className={styles.actionBtn}>
                  认领此房源
                </Button>
              )}
              <Button color="success" onClick={handleCopyLink} className={styles.actionBtn}>
                复制分享链接
              </Button>
            </div>
            <p className={styles.actionTip}>认领后，将链接发给客户，客户看到的是您的名片</p>
          </div>
        )}

        <div className={styles.bottomSafe} />
      </div>
    </div>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 0' }}>
      <span style={{ fontSize: 12, color: '#999' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 500, color: '#333' }}>{value}</span>
    </div>
  )
}

import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { NavBar, Tag, Divider, Toast, Button } from 'antd-mobile'
import { MapPin } from 'lucide-react'
import DOMPurify from 'dompurify'
import ImageGallery from '../../components/ImageGallery'
import AgentCard from '../../components/AgentCard'
import { getPropertyDetail, claimProperty, unclaimProperty, Property } from '../../api/property'
import { getMyProfile } from '../../api/agent'
import { useAuthStore } from '../../store/auth'
import { useWechatShare } from '../../hooks/useWechatShare'
import { getImageUrl } from '../../utils/image'
import {
  formatArea,
  formatFloor,
  formatLayout,
  formatPrice,
  formatPropertyStatus,
  formatUnitPrice,
} from '../../utils/format'
import styles from './index.module.css'

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const agentCode = searchParams.get('a') || ''
  
  const isAgent = useAuthStore(state => state.isAgent())
  const [property, setProperty] = useState<Property | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<'not_found' | 'load_failed' | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [claiming, setClaiming] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [myAgentCode, setMyAgentCode] = useState('')

  const claimed = property?.is_claimed ?? false
  const sanitizedDescription = useMemo(
    () => property?.description ? DOMPurify.sanitize(property.description) : '',
    [property?.description]
  )
  const displayAgentCode = (isAgent && myAgentCode) || agentCode || property?.agent?.agent_code || ''
  const shareLink = id ? createPropertyShareLink(id, displayAgentCode) : window.location.href
  const price = property?.property_type === 'rent' ? property.monthly_rent : property?.total_price

  useWechatShare({
    title: property?.title || '房源详情',
    desc: property ? [property.district, formatLayout(property.bedrooms, property.living_rooms, property.bathrooms), formatArea(property.area)].filter(Boolean).join(' · ') : '',
    link: shareLink,
    imgUrl: property?.cover_image ? getImageUrl(property.cover_image) : '',
  }, Boolean(property))

  useEffect(() => {
    document.title = property?.title || '房源详情'
  }, [property?.title])

  useEffect(() => {
    if (!isAgent) {
      setMyAgentCode('')
      return
    }

    let cancelled = false
    getMyProfile()
      .then(result => {
        if (!cancelled && result.code === 0) setMyAgentCode(result.data?.agent_code || '')
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [isAgent])

  useEffect(() => {
    const propertyId = Number(id)
    if (!Number.isInteger(propertyId) || propertyId <= 0) {
      setLoading(false)
      setLoadError('not_found')
      return
    }

    const controller = new AbortController()
    setLoading(true)
    setLoadError(null)
    setProperty(null)

    getPropertyDetail(propertyId, agentCode || undefined, controller.signal)
      .then(d => {
        if (controller.signal.aborted) return
        if (d.code === 0 && d.data) {
          setProperty(d.data)
        } else {
          setLoadError(d.code === 404 ? 'not_found' : 'load_failed')
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadError('load_failed')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [id, agentCode, reloadKey])

  const handleClaim = async () => {
    if (!id || claiming) return
    setClaiming(true)
    try {
      const result = await claimProperty(Number(id))
      if (result.code !== 0) throw new Error(result.message || '认领失败，请重试')
      setProperty(current => current ? { ...current, is_claimed: true } : current)
      getMyProfile()
        .then(profile => {
          if (profile.code === 0) setMyAgentCode(profile.data?.agent_code || '')
        })
        .catch(() => {})
      Toast.show({ content: '认领成功！现在分享给客户吧', icon: 'success' })
    } catch (error) {
      Toast.show({ content: getErrorMessage(error, '认领失败，请重试'), icon: 'fail' })
    } finally {
      setClaiming(false)
    }
  }

  const handleUnclaim = async () => {
    if (!id || claiming) return
    setClaiming(true)
    try {
      const result = await unclaimProperty(Number(id))
      if (result.code !== 0) throw new Error(result.message || '取消认领失败')
      setProperty(current => current ? { ...current, is_claimed: false, my_claim_commission: null } : current)
      Toast.show({ content: '已取消认领', icon: 'success' })
    } catch (error) {
      Toast.show({ content: getErrorMessage(error, '操作失败'), icon: 'fail' })
    } finally {
      setClaiming(false)
    }
  }

  const handleCopyLink = async () => {
    if (!id || sharing) return
    setSharing(true)
    try {
      const result = await getMyProfile()
      if (result.code !== 0 || !result.data?.agent_code) {
        throw new Error(result.message || '未获取到您的经纪人编码')
      }
      setMyAgentCode(result.data.agent_code)
      await copyText(createPropertyShareLink(id, result.data.agent_code))
      Toast.show({ content: '专属链接已复制，快去分享吧！', icon: 'success' })
    } catch (error) {
      Toast.show({ content: getErrorMessage(error, '链接复制失败，请重试'), icon: 'fail' })
    } finally {
      setSharing(false)
    }
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
    return (
      <div className={styles.empty}>
        <p>{loadError === 'load_failed' ? '房源加载失败，请检查网络后重试' : '房源不存在或已下架'}</p>
        {loadError === 'load_failed' && (
          <Button color="primary" onClick={() => setReloadKey(key => key + 1)}>重新加载</Button>
        )}
      </div>
    )
  }

  const statusColor = property.status === 'available' ? 'success' : 'default'
  const priceText = formatPrice(price ?? null, property.property_type)

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
          <Tag color={statusColor} className={styles.statusTag}>
            {formatPropertyStatus(property.status)}
          </Tag>
        </div>
        <div className={styles.title}>{property.title}</div>

        {/* 基本信息 */}
        <div className={styles.infoGrid}>
          <InfoItem label="户型" value={formatLayout(property.bedrooms, property.living_rooms, property.bathrooms)} />
          <InfoItem label="面积" value={formatArea(property.area)} />
          <InfoItem label="楼层" value={formatFloor(property.floor, property.total_floors)} />
          <InfoItem label="朝向" value={property.direction || '—'} />
          <InfoItem label="装修" value={property.decoration || '—'} />
          {property.unit_price != null && (
            <InfoItem label="单价" value={formatUnitPrice(property.unit_price)} />
          )}
          <InfoItem label="电梯" value={property.has_elevator ? '有' : '无'} />
          {property.parking != null && <InfoItem label="车位" value={`${property.parking}个`} />}
          {property.building_age != null && <InfoItem label="楼龄" value={`${property.building_age}年`} />}
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
        {sanitizedDescription && (
          <>
            <Divider />
            <div className={styles.section}>
              <div className={styles.sectionTitle}>房源详情</div>
              <div
                className={styles.richContent}
                dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
              />
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
                <Button color="default" fill="outline" loading={claiming} onClick={handleUnclaim} className={styles.actionBtn}>
                  取消认领
                </Button>
              ) : (
                <Button color="primary" loading={claiming} onClick={handleClaim} className={styles.actionBtn}>
                  认领此房源
                </Button>
              )}
              <Button color="success" loading={sharing} onClick={handleCopyLink} className={styles.actionBtn}>
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
    <div className={styles.infoItem}>
      <span className={styles.infoLabel}>{label}</span>
      <span className={styles.infoValue}>{value}</span>
    </div>
  )
}

function createPropertyShareLink(id: string, agentCode: string) {
  const url = new URL(`/p/${id}`, window.location.origin)
  if (agentCode) url.searchParams.set('a', agentCode)
  return url.toString()
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

async function copyText(text: string) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  textarea.remove()
  if (!copied) throw new Error('复制失败，请手动复制浏览器地址')
}

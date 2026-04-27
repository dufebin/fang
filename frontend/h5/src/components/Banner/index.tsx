import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './index.module.css'

interface Banner {
  id: number
  title: string
  image_url: string
  link_type: 'property' | 'external' | 'none'
  link_value: string
  position: string
  sort_order: number
  is_active: boolean
}

const BACKEND_URL = 'http://localhost:9080' // 开发环境后端地址

export default function Banner() {
  const navigate = useNavigate()
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    let cancelled = false

    fetch('/api/h5/banners')
      .then(r => r.json())
      .then(d => {
        if (cancelled) return
        if (d.code === 0 && Array.isArray(d.data)) {
          // 过滤出首页banner并按sort_order排序
          const homeBanners = d.data
            .filter((b: Banner) => b.position === 'home' && b.is_active)
            .sort((a: Banner, b: Banner) => a.sort_order - b.sort_order)
          setBanners(homeBanners)
        }
      })
      .catch(e => {
        if (cancelled) return
        console.error('获取Banner失败:', e)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  // 自动轮播
  useEffect(() => {
    if (banners.length <= 1) return

    const timer = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % banners.length)
    }, 4000) // 4秒切换

    return () => clearInterval(timer)
  }, [banners.length])

  const handleBannerClick = useCallback((banner: Banner) => {
    if (banner.link_type === 'none') return
    
    if (banner.link_type === 'property') {
      // 跳转到房源详情
      navigate(`/p/${banner.link_value}`)
    } else if (banner.link_type === 'external') {
      // 外部链接
      window.open(banner.link_value, '_blank')
    }
  }, [navigate])

  const handleDotClick = useCallback((index: number) => {
    setCurrentIndex(index)
  }, [])

  if (loading || banners.length === 0) {
    return null // 没有banner时不显示
  }

  const currentBanner = banners[currentIndex]
  
  // 处理图片URL
  const imageUrl = currentBanner.image_url.startsWith('/') 
    ? BACKEND_URL + currentBanner.image_url 
    : currentBanner.image_url

  return (
    <div className={styles.bannerContainer}>
      <div 
        className={styles.bannerWrapper}
        onClick={() => handleBannerClick(currentBanner)}
        style={{ cursor: currentBanner.link_type !== 'none' ? 'pointer' : 'default' }}
      >
        <img 
          src={imageUrl} 
          alt={currentBanner.title}
          className={styles.bannerImage}
          onError={(e) => {
            // 图片加载失败时的兜底
            (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNzIwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSI+54mZ54S25ZCI6LWEPC90ZXh0Pjwvc3ZnPg=='
          }}
        />
      </div>

      {/* 指示点 */}
      {banners.length > 1 && (
        <div className={styles.dots}>
          {banners.map((_, index) => (
            <span
              key={index}
              className={`${styles.dot} ${index === currentIndex ? styles.dotActive : ''}`}
              onClick={() => handleDotClick(index)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

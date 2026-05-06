import React, { useState, useRef } from 'react'
import { Swiper, ImageViewer } from 'antd-mobile'
import type { SwiperRef } from 'antd-mobile/es/components/swiper'
import { PropertyImage } from '../../api/property'
import styles from './index.module.css'

interface Props {
  images: PropertyImage[]
  coverImage?: string
}

export default function ImageGallery({ images, coverImage }: Props) {
  const [viewerIndex, setViewerIndex] = useState(0)
  const [viewerVisible, setViewerVisible] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const swiperRef = useRef<SwiperRef>(null)

  const allImages = images.length > 0
    ? images.map(img => img.url)
    : coverImage ? [coverImage] : []

  if (allImages.length === 0) {
    return (
      <div className={styles.placeholder}>
        <span>暂无图片</span>
      </div>
    )
  }

  const handleClick = (index: number) => {
    setViewerIndex(index)
    setViewerVisible(true)
  }

  const showArrows = allImages.length > 1

  return (
    <div className={styles.gallery}>
      <Swiper
        ref={swiperRef}
        className={styles.swiper}
        onIndexChange={setCurrentIndex}
        indicator={(total, current) => (
          <div className={styles.counter}>{current + 1} / {total}</div>
        )}
      >
        {allImages.map((url, i) => (
          <Swiper.Item key={i} onClick={() => handleClick(i)}>
            <div className={styles.slide}>
              <img src={url} alt={`房源图片${i + 1}`} className={styles.slideImg} />
            </div>
          </Swiper.Item>
        ))}
      </Swiper>

      {showArrows && (
        <>
          <button
            className={`${styles.arrow} ${styles.arrowLeft} ${currentIndex === 0 ? styles.arrowHidden : ''}`}
            onClick={(e) => { e.stopPropagation(); swiperRef.current?.swipePrev() }}
            aria-label="上一张"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            className={`${styles.arrow} ${styles.arrowRight} ${currentIndex === allImages.length - 1 ? styles.arrowHidden : ''}`}
            onClick={(e) => { e.stopPropagation(); swiperRef.current?.swipeNext() }}
            aria-label="下一张"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </>
      )}

      <ImageViewer.Multi
        key={viewerIndex}
        images={allImages}
        visible={viewerVisible}
        defaultIndex={viewerIndex}
        onClose={() => setViewerVisible(false)}
      />
    </div>
  )
}

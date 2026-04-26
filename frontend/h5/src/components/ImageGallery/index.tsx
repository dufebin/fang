import React, { useState } from 'react'
import { ImageViewer } from 'antd-mobile'
import { PropertyImage } from '../../api/property'
import styles from './index.module.css'

interface Props {
  images: PropertyImage[]
  coverImage?: string
}

export default function ImageGallery({ images, coverImage }: Props) {
  const [visible, setVisible] = useState(false)
  const [current, setCurrent] = useState(0)

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
    setCurrent(index)
    setVisible(true)
  }

  return (
    <div className={styles.gallery}>
      <div className={styles.mainImage} onClick={() => handleClick(0)}>
        <img src={allImages[0]} alt="房源图片" />
        {allImages.length > 1 && (
          <div className={styles.count}>{allImages.length}张</div>
        )}
      </div>

      {allImages.length > 1 && (
        <div className={styles.thumbs}>
          {allImages.slice(1, 4).map((url, i) => (
            <div key={i} className={styles.thumb} onClick={() => handleClick(i + 1)}>
              <img src={url} alt={`房源图片${i + 2}`} />
              {i === 2 && allImages.length > 4 && (
                <div className={styles.more}>+{allImages.length - 4}</div>
              )}
            </div>
          ))}
        </div>
      )}

      <ImageViewer.Multi
        images={allImages}
        visible={visible}
        defaultIndex={current}
        onClose={() => setVisible(false)}
      />
    </div>
  )
}

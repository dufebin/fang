import React, { useEffect, useState } from 'react'
import { NavBar } from 'antd-mobile'
import { useParams, useNavigate } from 'react-router-dom'
import { getArticleDetail, Article } from '../../api/content'
import styles from './index.module.css'

const CATEGORY_LABEL: Record<string, string> = {
  market: '市场动态',
  guide: '购房指南',
  policy: '政策解读',
  news: '行业新闻',
}

function formatDate(s: string) {
  return s ? s.slice(0, 10) : ''
}

function DetailSkeleton() {
  return (
    <div className={styles.skeletonWrap}>
      <div className={styles.skeletonCover} />
      <div className={styles.skeletonBody}>
        <div className={`${styles.skeletonLine} ${styles.skeletonH1}`} />
        <div className={`${styles.skeletonLine} ${styles.skeletonH1Short}`} />
        <div className={`${styles.skeletonLine} ${styles.skeletonMeta}`} />
        <div className={styles.skeletonDivider} />
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={`${styles.skeletonLine} ${styles.skeletonPara}`}
            style={{ width: i % 3 === 2 ? '55%' : '100%' }}
          />
        ))}
      </div>
    </div>
  )
}

export default function ArticleDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getArticleDetail(Number(id))
      .then(res => { if (res.code === 0) setArticle(res.data) })
      .finally(() => setLoading(false))
  }, [id])

  return (
    <div className={styles.page}>
      <NavBar onBack={() => navigate(-1)} className={styles.nav}>
        {article ? (CATEGORY_LABEL[article.category] ?? article.category) : '资讯详情'}
      </NavBar>

      {loading ? (
        <DetailSkeleton />
      ) : article ? (
        <>
          {article.cover_image && (
            <img className={styles.cover} src={article.cover_image} alt={article.title} />
          )}
          <div className={styles.body}>
            <h1 className={styles.title}>{article.title}</h1>
            {article.summary && (
              <p className={styles.summary}>{article.summary}</p>
            )}
            <div className={styles.meta}>
              <span className={styles.categoryTag}>
                {CATEGORY_LABEL[article.category] ?? article.category}
              </span>
              <span className={styles.dot}>·</span>
              <span>{formatDate(article.published_at)}</span>
              {article.author && (
                <>
                  <span className={styles.dot}>·</span>
                  <span>{article.author}</span>
                </>
              )}
              <span className={styles.dot}>·</span>
              <span>{article.view_count} 次阅读</span>
            </div>
            <div
              className={styles.content}
              dangerouslySetInnerHTML={{ __html: article.content }}
            />
          </div>
        </>
      ) : (
        <div className={styles.error}>文章不存在或已下架</div>
      )}
    </div>
  )
}

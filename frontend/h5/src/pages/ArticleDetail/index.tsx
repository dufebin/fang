import React, { useEffect, useState } from 'react'
import { NavBar } from 'antd-mobile'
import { useParams, useNavigate } from 'react-router-dom'
import { getArticleDetail, Article } from '../../api/content'
import styles from './index.module.css'

function formatDate(s: string) {
  return s ? s.slice(0, 10) : ''
}

export default function ArticleDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [article, setArticle] = useState<Article | null>(null)

  useEffect(() => {
    if (!id) return
    getArticleDetail(Number(id)).then(res => {
      if (res.code === 0) setArticle(res.data)
    })
  }, [id])

  return (
    <div className={styles.page}>
      <NavBar onBack={() => navigate(-1)} className={styles.nav}>
        {article?.category || '资讯详情'}
      </NavBar>

      {article ? (
        <>
          {article.cover_image && (
            <img className={styles.cover} src={article.cover_image} alt={article.title} />
          )}
          <div className={styles.body}>
            <h1 className={styles.title}>{article.title}</h1>
            <div className={styles.meta}>
              <span>{article.category}</span>
              <span>·</span>
              <span>{formatDate(article.published_at)}</span>
              <span>·</span>
              <span>{article.view_count}次阅读</span>
            </div>
            <div
              className={styles.content}
              dangerouslySetInnerHTML={{ __html: article.content }}
            />
          </div>
        </>
      ) : (
        <div style={{ padding: 40, textAlign: 'center', color: '#bbb' }}>加载中...</div>
      )}
    </div>
  )
}

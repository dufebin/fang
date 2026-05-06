import React, { useState, useCallback, useEffect, useRef } from 'react'
import { NavBar, Tabs } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { getArticleList, Article } from '../../api/content'
import BottomNav from '../../components/BottomNav'
import styles from './index.module.css'

const CATEGORIES = [
  { key: '', label: '全部' },
  { key: 'market', label: '市场动态' },
  { key: 'guide', label: '购房指南' },
  { key: 'policy', label: '政策解读' },
  { key: 'news', label: '行业新闻' },
]

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIES.filter(c => c.key).map(c => [c.key, c.label])
)

function formatDate(s: string) {
  if (!s) return ''
  return s.slice(0, 10)
}

function SkeletonCard() {
  return (
    <div className={styles.card} style={{ pointerEvents: 'none' }}>
      <div className={`${styles.thumb} ${styles.skeleton}`} />
      <div className={styles.info}>
        <div className={`${styles.skeletonLine} ${styles.skeletonTitle}`} />
        <div className={`${styles.skeletonLine} ${styles.skeletonTitleShort}`} />
        <div className={`${styles.skeletonLine} ${styles.skeletonMeta}`} />
      </div>
    </div>
  )
}

export default function ArticleList() {
  const navigate = useNavigate()
  const [list, setList] = useState<Article[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [category, setCategory] = useState('')
  const loadingRef = useRef(false)

  const reset = (cat: string) => {
    setList([])
    setPage(1)
    setHasMore(true)
    setLoading(true)
    setCategory(cat)
  }

  const loadMore = useCallback(async (isFirst = false) => {
    if (loadingRef.current) return
    loadingRef.current = true
    try {
      const currentPage = isFirst ? 1 : page
      const res = await getArticleList({ page: currentPage, page_size: 15, category: category || undefined })
      if (res.code === 0) {
        const items: Article[] = res.data.list || []
        setList(prev => isFirst ? items : [...prev, ...items])
        setPage(currentPage + 1)
        setHasMore(items.length >= 15)
      } else {
        setHasMore(false)
      }
    } catch {
      setHasMore(false)
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }, [page, category])

  useEffect(() => {
    loadMore(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category])

  return (
    <div className={styles.page}>
      <NavBar back={null} className={styles.nav}>房产资讯</NavBar>

      <div className={styles.tabs}>
        <Tabs
          activeKey={category}
          onChange={(key) => reset(key)}
          style={{ '--active-title-color': '#E84040', '--active-line-color': '#E84040' } as React.CSSProperties}
        >
          {CATEGORIES.map(c => <Tabs.Tab key={c.key} title={c.label} />)}
        </Tabs>
      </div>

      <div className={styles.list}>
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
        ) : list.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>📰</div>
            <div className={styles.emptyText}>暂无资讯</div>
            <div className={styles.emptyHint}>敬请期待更多内容更新</div>
          </div>
        ) : (
          <>
            {list.map(a => (
              <div key={a.id} className={styles.card} onClick={() => navigate(`/articles/${a.id}`)}>
                {a.cover_image ? (
                  <img className={styles.thumb} src={a.cover_image} alt={a.title} loading="lazy" />
                ) : (
                  <div className={styles.thumbPlaceholder}>
                    <span className={styles.thumbPlaceholderLabel}>
                      {CATEGORY_LABEL[a.category] ?? '资讯'}
                    </span>
                  </div>
                )}
                <div className={styles.info}>
                  <div className={styles.title}>{a.title}</div>
                  {a.summary && <div className={styles.summary}>{a.summary}</div>}
                  <div className={styles.meta}>
                    <span className={styles.categoryTag}>
                      {CATEGORY_LABEL[a.category] ?? a.category}
                    </span>
                    <span className={styles.dot}>·</span>
                    <span>{formatDate(a.published_at)}</span>
                    <span className={styles.dot}>·</span>
                    <span>{a.view_count} 阅读</span>
                  </div>
                </div>
              </div>
            ))}

            {hasMore ? (
              <div className={styles.loadMore} onClick={() => loadMore()}>加载更多</div>
            ) : (
              <div className={styles.noMore}>— 没有更多了 —</div>
            )}
          </>
        )}
      </div>

      <BottomNav />
    </div>
  )
}

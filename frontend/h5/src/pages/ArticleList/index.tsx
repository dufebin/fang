import React, { useState, useCallback, useEffect } from 'react'
import { NavBar, Tabs } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { getArticleList, Article } from '../../api/content'
import BottomNav from '../../components/BottomNav'
import styles from './index.module.css'

const CATEGORIES = [
  { key: '', label: '全部' },
  { key: '市场动态', label: '市场动态' },
  { key: '购房指南', label: '购房指南' },
  { key: '政策解读', label: '政策解读' },
  { key: '装修百科', label: '装修百科' },
]

function formatDate(s: string) {
  if (!s) return ''
  return s.slice(0, 10)
}

export default function ArticleList() {
  const navigate = useNavigate()
  const [list, setList] = useState<Article[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(1)
  const [category, setCategory] = useState('')

  const reset = (cat: string) => {
    setList([])
    setPage(1)
    setHasMore(true)
    setCategory(cat)
  }

  const loadMore = useCallback(async () => {
    try {
      const res = await getArticleList({ page, page_size: 15, category: category || undefined })
      if (res.code === 0) {
        const items: Article[] = res.data.list || []
        setList(prev => [...prev, ...items])
        setPage(p => p + 1)
        setHasMore(items.length >= 15)
      } else {
        setHasMore(false)
      }
    } catch {
      setHasMore(false)
    }
  }, [page, category])

  // 初始加载
  useEffect(() => {
    loadMore()
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
        {list.map(a => (
          <div key={a.id} className={styles.card} onClick={() => navigate(`/articles/${a.id}`)}>
            {a.cover_image && (
              <img className={styles.thumb} src={a.cover_image} alt={a.title} />
            )}
            <div className={styles.info}>
              <div className={styles.title}>{a.title}</div>
              <div className={styles.meta}>
                <span>{a.category}</span>
                <span className={styles.dot}>·</span>
                <span>{formatDate(a.published_at)}</span>
                <span className={styles.dot}>·</span>
                <span>{a.view_count}次阅读</span>
              </div>
            </div>
          </div>
        ))}
        
        {hasMore ? (
          <div className={styles.loadMore} onClick={loadMore}>加载更多</div>
        ) : (
          <div className={styles.noMore}>没有更多了</div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}

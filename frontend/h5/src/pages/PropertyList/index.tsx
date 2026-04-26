import React, { useEffect, useState, useCallback } from 'react'
import { SearchBar, Tabs, InfiniteScroll, NavBar } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { Property, getPropertyList, getAllProperties } from '../../api/property'
import PropertyCard from '../../components/PropertyCard'
import { useAuthStore } from '../../store/auth'
import styles from './index.module.css'

const PROPERTY_TYPES = [
  { key: '', label: '全部' },
  { key: '二手房', label: '二手房' },
  { key: '新房', label: '新房' },
  { key: '租房', label: '租房' },
  { key: '商铺', label: '商铺' },
]

export default function PropertyList() {
  const navigate = useNavigate()
  const { isAgent } = useAuthStore()
  const [list, setList] = useState<Property[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(1)
  const [activeType, setActiveType] = useState('')
  const [keyword, setKeyword] = useState('')

  const reset = () => {
    setList([])
    setPage(1)
    setHasMore(true)
  }

  const loadMore = useCallback(async () => {
    const fetchFn = isAgent() ? getAllProperties : getPropertyList
    const res = await fetchFn({ page, limit: 10, type: activeType || undefined, keyword: keyword || undefined })

    if (res.code === 0) {
      const data = res.data
      setList(prev => [...prev, ...data.list])
      setPage(prev => prev + 1)
      setHasMore(data.list.length >= 10 && data.list.length + (page - 1) * 10 < data.total)
    } else {
      setHasMore(false)
    }
  }, [page, activeType, keyword, isAgent])

  useEffect(() => {
    reset()
  }, [activeType, keyword])

  const handleSearch = (val: string) => {
    setKeyword(val)
  }

  return (
    <div className={styles.page}>
      <NavBar back={null} className={styles.nav}>房源列表</NavBar>

      <div className={styles.searchBar}>
        <SearchBar
          placeholder="搜索楼盘名称、地址"
          onSearch={handleSearch}
          onClear={() => handleSearch('')}
        />
      </div>

      <Tabs
        activeKey={activeType}
        onChange={(key) => setActiveType(key)}
        className={styles.tabs}
      >
        {PROPERTY_TYPES.map(t => (
          <Tabs.Tab title={t.label} key={t.key} />
        ))}
      </Tabs>

      <div className={styles.list}>
        {list.map(item => (
          <PropertyCard key={item.id} property={item} />
        ))}
        <InfiniteScroll loadMore={loadMore} hasMore={hasMore} />
      </div>

      <div className={styles.bottomNav}>
        <div className={styles.bottomNavItem}>
          <span className={styles.bottomNavIcon}>🏠</span>
          <span>找房</span>
        </div>
        <div className={styles.bottomNavItem} onClick={() => navigate('/articles')}>
          <span className={styles.bottomNavIcon}>📰</span>
          <span>资讯</span>
        </div>
        <div className={styles.bottomNavItem} onClick={() => navigate('/loan-calculator')}>
          <span className={styles.bottomNavIcon}>🧮</span>
          <span>贷款计算</span>
        </div>
      </div>
    </div>
  )
}

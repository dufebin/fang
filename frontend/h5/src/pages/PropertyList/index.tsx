import React, { useEffect, useState } from 'react'
import { SearchBar, Tabs, NavBar } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import Banner from '../../components/Banner'
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
  const [list, setList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeType, setActiveType] = useState('')
  const [keyword, setKeyword] = useState('')

  // 直接用fetch，在useEffect内部
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    
    const params = new URLSearchParams()
    params.set('page', '1')
    params.set('limit', '100')
    if (activeType) params.set('type', activeType)
    if (keyword) params.set('keyword', keyword)
    
    const url = `/api/h5/properties?${params.toString()}`
    console.log('请求URL:', url)
    
    fetch(url)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return
        console.log('API返回:', d)
        if (d.code === 0 && d.data && d.data.list) {
          console.log('设置房源数据:', d.data.list.length, '条')
          setList(d.data.list)
        } else {
          console.error('API错误:', d.message)
          setList([])
        }
      })
      .catch(e => {
        if (cancelled) return
        console.error('请求失败:', e)
        setList([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    
    // 清理函数：组件卸载时取消请求
    return () => { cancelled = true }
  }, [activeType, keyword])

  return (
    <div className={styles.page}>
      <NavBar back={null} className={styles.nav}>房源列表</NavBar>

      {/* Banner 轮播 */}
      <Banner />

      <div className={styles.searchBar}>
        <SearchBar
          placeholder="搜索楼盘名称、地址"
          onSearch={(val) => setKeyword(val)}
          onClear={() => setKeyword('')}
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

      <div className={styles.list} id="property-list">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>加载中...</div>
        ) : list.length > 0 ? (
          list.map((item: any) => (
            <div key={item.id} style={{ padding: '10px', borderBottom: '1px solid #eee' }}>
              <div><strong>{item.title}</strong></div>
              <div>{item.city} {item.district} {item.property_type}</div>
              <div>{item.total_price}万 / {item.area}㎡</div>
            </div>
          ))
        ) : (
          <div style={{ textAlign: 'center', padding: '20px' }}>暂无房源数据</div>
        )}
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

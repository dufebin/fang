import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { NavBar, Avatar } from 'antd-mobile'
import { Phone } from 'lucide-react'
import PropertyCard from '../../components/PropertyCard'
import { Property } from '../../api/property'
import styles from './index.module.css'

interface Agent {
  id: number
  name: string
  phone: string
  wechat_id: string
  wechat_qr_url: string
  avatar_url: string
  bio: string
  agent_code: string
}

export default function AgentHome() {
  const { agent_code } = useParams<{ agent_code: string }>()
  const [searchParams] = useSearchParams()
  const code = agent_code || searchParams.get('a') || ''
  
  const [agent, setAgent] = useState<Agent | null>(null)
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(1)

  // 加载房源和经纪人信息
  const loadData = async (pageNum: number) => {
    if (!code) {
      setLoading(false)
      return
    }

    try {
      // 请求经纪人房源列表（这个接口返回房源，房源里包含 agent 信息）
      const url = `/api/h5/agent/${code}?page=${pageNum}&limit=10`
      console.log('请求经纪人房源:', url)
      
      const res = await fetch(url).then(r => r.json())
      console.log('经纪人房源响应:', res)
      
      if (res.code === 0 && res.data) {
        const newProps = res.data.list || []
        
        // 从第一个房源提取经纪人信息（如果有）
        if (newProps.length > 0 && newProps[0].agent) {
          setAgent(newProps[0].agent)
        }
        
        if (pageNum === 1) {
          setProperties(newProps)
        } else {
          setProperties(prev => [...prev, ...newProps])
        }
        
        setHasMore(newProps.length >= 10)
        setPage(pageNum + 1)
      } else if (res.code === 404) {
        // 经纪人不存在
        console.error('经纪人不存在:', code)
        setAgent(null)
        setProperties([])
        setHasMore(false)
      } else {
        console.error('API返回错误:', res.message)
        if (pageNum === 1) setProperties([])
        setHasMore(false)
      }
    } catch (err) {
      console.error('请求失败:', err)
      if (pageNum === 1) setProperties([])
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }

  // 初始加载
  useEffect(() => {
    if (!code) return
    setLoading(true)
    setProperties([])
    setPage(1)
    setHasMore(true)
    loadData(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  const loadMore = useCallback(async () => {
    if (!hasMore) return
    await loadData(page)
  }, [hasMore, page])

  return (
    <div className={styles.page}>
      <NavBar onBack={() => window.history.back()} className={styles.nav}>
        {agent ? agent.name : '房产顾问'}
      </NavBar>

      {agent && (
        <div className={styles.profile}>
          <Avatar
            src={agent.avatar_url || '/default-avatar.png'}
            style={{ '--size': '64px', '--border-radius': '50%' } as React.CSSProperties}
          />
          <div className={styles.info}>
            <div className={styles.name}>{agent.name}</div>
            <div className={styles.bio}>{agent.bio || '专业房产顾问'}</div>
            <div className={styles.phone}><Phone size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />{agent.phone}</div>
          </div>
        </div>
      )}

      <div className={styles.listTitle}>
        {agent ? `${agent.name}的房源` : '在售房源'}
      </div>

      <div className={styles.list}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>加载中...</div>
        ) : properties.length > 0 ? (
          properties.map(item => (
            <PropertyCard key={item.id} property={item} agentCode={code} />
          ))
        ) : (
          <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
            暂无房源
          </div>
        )}

        {hasMore && !loading && (
          <div className={styles.loadMore} onClick={loadMore}>加载更多</div>
        )}
      </div>

      <div className={styles.bottomSafe} />
    </div>
  )
}

import React, { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { NavBar, Avatar, InfiniteScroll } from 'antd-mobile'
import { Property, getAgentProperties } from '../../api/property'
import { Agent } from '../../api/agent'
import PropertyCard from '../../components/PropertyCard'
import styles from './index.module.css'

export default function AgentHome() {
  const { agent_code } = useParams<{ agent_code: string }>()
  const [searchParams] = useSearchParams()
  const code = agent_code || searchParams.get('a') || ''

  const [agent, setAgent] = useState<Agent | null>(null)
  const [properties, setProperties] = useState<Property[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(1)

  useEffect(() => {
    // 从房源数据里获取agent信息（通过第一次加载）
    if (!code) return
  }, [code])

  const loadMore = async () => {
    if (!code) { setHasMore(false); return }
    const res = await getAgentProperties(code, { page, limit: 10 })
    if (res.code === 0) {
      const data = res.data
      setProperties(prev => [...prev, ...data.list])
      setPage(prev => prev + 1)
      setHasMore(data.list.length >= 10)
    } else {
      setHasMore(false)
    }
  }

  return (
    <div className={styles.page}>
      <NavBar onBack={() => window.history.back()} className={styles.nav}>
        {agent ? agent.name : '房产顾问'}
      </NavBar>

      {agent && (
        <div className={styles.profile}>
          <Avatar
            src={agent.avatar_url || '/default-avatar.png'}
            style={{ '--size': '64px', '--border-radius': '50%' }}
          />
          <div className={styles.info}>
            <div className={styles.name}>{agent.name}</div>
            <div className={styles.bio}>{agent.bio || '专业房产顾问'}</div>
            <div className={styles.phone}>📞 {agent.phone}</div>
          </div>
        </div>
      )}

      <div className={styles.listTitle}>
        {agent ? `${agent.name}的房源` : '在售房源'}
      </div>

      <div className={styles.list}>
        {properties.map(item => (
          <PropertyCard key={item.id} property={item} agentCode={code} />
        ))}
        <InfiniteScroll loadMore={loadMore} hasMore={hasMore} />
      </div>
    </div>
  )
}

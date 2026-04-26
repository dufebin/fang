import React, { useEffect, useState } from 'react'
import { Row, Col, Card, Statistic, Table, Progress, Tag, Spin } from 'antd'
import { EyeOutlined, HomeOutlined, TeamOutlined, CalendarOutlined } from '@ant-design/icons'
import {
  getOverview,
  getPropertyTypeDistribution,
  getAgentRanking,
  getViewTrend,
  getConversionFunnel,
} from '../../api/stats'

interface OverviewData {
  total_properties: number
  available_properties: number
  total_agents: number
  active_agents: number
  total_users: number
  total_appointments: number
  total_views: number
  today_views: number
}

interface TypeDist { property_type: string; count: number }
interface AgentRank { agent_id: number; name: string; total_views: number; favorite_count: number; appointment_count: number }
interface ViewTrendItem { date: string; views: number }
interface FunnelItem { stage: string; count: number }

export default function StatisticsPage() {
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [typeDist, setTypeDist] = useState<TypeDist[]>([])
  const [agentRanking, setAgentRanking] = useState<AgentRank[]>([])
  const [viewTrend, setViewTrend] = useState<ViewTrendItem[]>([])
  const [funnel, setFunnel] = useState<FunnelItem[]>([])

  useEffect(() => {
    Promise.all([
      getOverview(),
      getPropertyTypeDistribution(),
      getAgentRanking({ limit: 10 }),
      getViewTrend({ days: 7 }),
      getConversionFunnel(),
    ]).then(([ov, td, ar, vt, fn]) => {
      setOverview(ov.data)
      setTypeDist(td.data || [])
      setAgentRanking(ar.data || [])
      setViewTrend(vt.data || [])
      setFunnel(fn.data || [])
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />

  const maxViews = Math.max(...(viewTrend || []).map(d => d.views), 1)

  return (
    <div>
      {/* 核心指标 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {[
          { title: '总房源', value: overview?.total_properties, icon: <HomeOutlined />, color: '#1677ff' },
          { title: '在售房源', value: overview?.available_properties, icon: <HomeOutlined />, color: '#52c41a' },
          { title: '经纪人', value: overview?.total_agents, icon: <TeamOutlined />, color: '#722ed1' },
          { title: '注册用户', value: overview?.total_users, icon: <TeamOutlined />, color: '#eb2f96' },
          { title: '总浏览量', value: overview?.total_views, icon: <EyeOutlined />, color: '#fa8c16' },
          { title: '今日浏览', value: overview?.today_views, icon: <EyeOutlined />, color: '#13c2c2' },
          { title: '总预约', value: overview?.total_appointments, icon: <CalendarOutlined />, color: '#f5222d' },
          { title: '活跃经纪人', value: overview?.active_agents, icon: <TeamOutlined />, color: '#a0d911' },
        ].map(item => (
          <Col key={item.title} xs={12} sm={8} md={6}>
            <Card size="small">
              <Statistic
                title={item.title}
                value={item.value ?? '--'}
                valueStyle={{ color: item.color, fontSize: 28, fontWeight: 700 }}
                prefix={item.icon}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        {/* 近7日浏览趋势 */}
        <Col xs={24} md={14}>
          <Card title="近7日浏览趋势" size="small">
            <div style={{ padding: '8px 0' }}>
              {(viewTrend || []).map(d => (
                <div key={d.date} style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ width: 80, fontSize: 12, color: '#888', flexShrink: 0 }}>{d.date}</div>
                  <Progress
                    percent={Math.round((d.views / maxViews) * 100)}
                    format={() => `${d.views}次`}
                    strokeColor="#1677ff"
                    style={{ flex: 1 }}
                  />
                </div>
              ))}
              {viewTrend.length === 0 && <div style={{ color: '#bbb', textAlign: 'center', padding: 20 }}>暂无数据</div>}
            </div>
          </Card>
        </Col>

        {/* 房源类型分布 */}
        <Col xs={24} md={10}>
          <Card title="房源类型分布" size="small">
            <div style={{ padding: '8px 0' }}>
              {(typeDist || []).map(d => (
                <div key={d.property_type} style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ width: 64, fontSize: 12, flexShrink: 0 }}>
                    <Tag color="blue">{d.property_type}</Tag>
                  </div>
                  <Progress
                    percent={Math.round((d.count / ((typeDist || []).reduce((s, x) => s + x.count, 0) || 1)) * 100)}
                    format={() => `${d.count}套`}
                    strokeColor="#52c41a"
                    style={{ flex: 1 }}
                  />
                </div>
              ))}
              {typeDist.length === 0 && <div style={{ color: '#bbb', textAlign: 'center', padding: 20 }}>暂无数据</div>}
            </div>
          </Card>
        </Col>

        {/* 经纪人排行 */}
        <Col xs={24} md={14}>
          <Card title="经纪人业绩排行（TOP 10）" size="small">
            <Table
              dataSource={agentRanking}
              rowKey="agent_id"
              size="small"
              pagination={false}
              columns={[
                { title: '排名', width: 48, render: (_, __, i) => <Tag color={i < 3 ? 'gold' : 'default'}>{i + 1}</Tag> },
                { title: '姓名', dataIndex: 'name' },
                { title: '浏览量', dataIndex: 'total_views', sorter: (a: AgentRank, b: AgentRank) => a.total_views - b.total_views },
                { title: '收藏', dataIndex: 'favorite_count' },
                { title: '预约', dataIndex: 'appointment_count' },
              ]}
            />
          </Card>
        </Col>

        {/* 转化漏斗 */}
        <Col xs={24} md={10}>
          <Card title="用户转化漏斗" size="small">
            <div style={{ padding: '8px 0' }}>
              {(funnel || []).map((f, i) => (
                <div key={f.stage} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13 }}>{f.stage}</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{f.count.toLocaleString()}</span>
                  </div>
                  <Progress
                    percent={i === 0 ? 100 : Math.round((f.count / (funnel[0]?.count || 1)) * 100)}
                    showInfo={false}
                    strokeColor={['#1677ff', '#52c41a', '#fa8c16', '#f5222d'][i] || '#bbb'}
                  />
                </div>
              ))}
              {funnel.length === 0 && <div style={{ color: '#bbb', textAlign: 'center', padding: 20 }}>暂无数据</div>}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

import React, { useEffect, useState } from 'react'
import { Card, Row, Col, Statistic, Typography } from 'antd'
import { HomeOutlined, TeamOutlined, EyeOutlined, RiseOutlined } from '@ant-design/icons'
import { getProperties } from '../../api/property'
import { getAgents } from '../../api/agent'

const { Title } = Typography

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalProperties: 0,
    availableProperties: 0,
    totalAgents: 0,
    activeAgents: 0,
  })

  useEffect(() => {
    Promise.all([
      getProperties({ page: 1, limit: 1 }),
      getProperties({ page: 1, limit: 1, status: 'available' }),
      getAgents({ page: 1, limit: 1 }),
      getAgents({ page: 1, limit: 1, status: 'active' }),
    ]).then(([all, available, allAgents, activeAgents]) => {
      setStats({
        totalProperties: all.data.total,
        availableProperties: available.data.total,
        totalAgents: allAgents.data.total,
        activeAgents: activeAgents.data.total,
      })
    }).catch(() => {})
  }, [])

  return (
    <div style={{ padding: '24px 0' }}>
      <Title level={4} style={{ marginBottom: 24 }}>数据概览</Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总房源数"
              value={stats.totalProperties}
              prefix={<HomeOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="在售房源"
              value={stats.availableProperties}
              prefix={<RiseOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="销售员总数"
              value={stats.totalAgents}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="在职销售员"
              value={stats.activeAgents}
              prefix={<EyeOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginTop: 24 }}>
        <Title level={5}>快速操作</Title>
        <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
          <Col>
            <Card size="small" hoverable style={{ cursor: 'pointer', textAlign: 'center', width: 120 }}
              onClick={() => window.location.href = '/admin/properties'}>
              <HomeOutlined style={{ fontSize: 24, color: '#1677ff' }} />
              <div style={{ marginTop: 8 }}>房源管理</div>
            </Card>
          </Col>
          <Col>
            <Card size="small" hoverable style={{ cursor: 'pointer', textAlign: 'center', width: 120 }}
              onClick={() => window.location.href = '/admin/agents'}>
              <TeamOutlined style={{ fontSize: 24, color: '#722ed1' }} />
              <div style={{ marginTop: 8 }}>销售员管理</div>
            </Card>
          </Col>
        </Row>
      </Card>

      <Card style={{ marginTop: 24 }}>
        <Title level={5}>使用说明</Title>
        <ol style={{ paddingLeft: 20, lineHeight: 2, color: '#555', fontSize: 14 }}>
          <li>在「房源管理」中录入房源信息，上传图片</li>
          <li>在「销售员管理」中创建销售员账号（需要先获取用户ID）</li>
          <li>销售员登录H5公众号后，可以认领任意房源</li>
          <li>认领后，销售员点击「复制分享链接」，将链接发给客户</li>
          <li>客户打开链接看到的是：房源详情 + 该销售员的微信名片</li>
          <li>更新房源信息后，所有分享链接自动显示最新数据</li>
        </ol>
      </Card>
    </div>
  )
}

import React, { useState } from 'react'
import {
  ProTable,
  ProColumns,
  ModalForm,
  ProFormText,
  ProFormDigit,
  ProFormTextArea,
} from '@ant-design/pro-components'
import { Button, Tag, message, Popconfirm, Avatar, Space } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { getAgents, createAgent, setAgentStatus, Agent } from '../../api/agent'

export default function AgentsPage() {
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [tableKey, setTableKey] = useState(0)

  const columns: ProColumns<Agent>[] = [
    {
      title: '头像',
      dataIndex: 'avatar_url',
      search: false,
      width: 60,
      render: (_, record) => (
        <Avatar src={record.avatar_url} size={40}>
          {record.name?.[0]}
        </Avatar>
      ),
    },
    {
      title: '姓名',
      dataIndex: 'name',
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      copyable: true,
    },
    {
      title: '微信号',
      dataIndex: 'wechat_id',
      copyable: true,
      search: false,
    },
    {
      title: '专属码',
      dataIndex: 'agent_code',
      copyable: true,
      search: false,
      render: (_, record) => (
        <Tag color="blue" style={{ fontFamily: 'monospace', fontSize: 13 }}>
          {record.agent_code}
        </Tag>
      ),
    },
    {
      title: '分享链接',
      search: false,
      render: (_, record) => {
        const link = `${window.location.origin}/p/1?a=${record.agent_code}`
        return (
          <Button
            type="link"
            size="small"
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/properties?a=${record.agent_code}`)
              message.success('链接已复制')
            }}
          >
            复制主页链接
          </Button>
        )
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      valueType: 'select',
      valueEnum: {
        active: { text: '正常' },
        inactive: { text: '停用' },
      },
      render: (_, record) => (
        <Tag color={record.status === 'active' ? 'success' : 'default'}>
          {record.status === 'active' ? '正常' : '停用'}
        </Tag>
      ),
    },
    {
      title: '注册时间',
      dataIndex: 'created_at',
      search: false,
      valueType: 'dateTime',
    },
    {
      title: '操作',
      valueType: 'option',
      render: (_, record) => [
        <Popconfirm
          key="toggle"
          title={record.status === 'active' ? '确认停用该销售员？' : '确认启用该销售员？'}
          onConfirm={async () => {
            const newStatus = record.status === 'active' ? 'inactive' : 'active'
            await setAgentStatus(record.id, newStatus)
            message.success(newStatus === 'active' ? '已启用' : '已停用')
            setTableKey(k => k + 1)
          }}
        >
          <Button
            type="link"
            size="small"
            danger={record.status === 'active'}
          >
            {record.status === 'active' ? '停用' : '启用'}
          </Button>
        </Popconfirm>,
      ],
    },
  ]

  return (
    <>
      <ProTable<Agent>
        key={tableKey}
        columns={columns}
        request={async (params) => {
          const res = await getAgents({
            page: params.current,
            limit: params.pageSize,
            status: params.status,
          })
          return {
            data: res.data.list,
            total: res.data.total,
            success: true,
          }
        }}
        rowKey="id"
        pagination={{ pageSize: 20 }}
        headerTitle="销售员管理"
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalOpen(true)}
          >
            新增销售员
          </Button>,
        ]}
      />

      <ModalForm
        title="新增销售员"
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onFinish={async (values) => {
          await createAgent(values as Parameters<typeof createAgent>[0])
          message.success('创建成功')
          setTableKey(k => k + 1)
          return true
        }}
        layout="vertical"
        grid
        modalProps={{ destroyOnClose: true }}
      >
        <ProFormDigit name="user_id" label="用户ID（微信openid对应的用户ID）" rules={[{ required: true }]} colProps={{ span: 24 }} />
        <ProFormText name="name" label="姓名" rules={[{ required: true }]} colProps={{ span: 12 }} />
        <ProFormText name="phone" label="手机号" rules={[{ required: true }]} colProps={{ span: 12 }} />
        <ProFormText name="wechat_id" label="微信号" colProps={{ span: 12 }} />
        <ProFormTextArea name="bio" label="个人简介" colProps={{ span: 24 }} fieldProps={{ rows: 3 }} />
      </ModalForm>
    </>
  )
}

import React, { useState } from 'react'
import { ProTable, ProColumns, ModalForm, ProFormTextArea } from '@ant-design/pro-components'
import { Tag, Button, message, Avatar, Space } from 'antd'
import { CheckOutlined, CloseOutlined } from '@ant-design/icons'
import { getApplications, approveApplication, rejectApplication, AgentApplication } from '../../api/application'

const STATUS_COLOR: Record<string, string> = {
  pending: 'orange',
  approved: 'green',
  rejected: 'red',
}
const STATUS_TEXT: Record<string, string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已拒绝',
}

export default function AgentApplicationsPage() {
  const [tableKey, setTableKey] = useState(0)
  const [rejectTarget, setRejectTarget] = useState<number | null>(null)
  const refresh = () => setTableKey(k => k + 1)

  const columns: ProColumns<AgentApplication>[] = [
    {
      title: '申请人',
      search: false,
      render: (_, r) => (
        <Space>
          <Avatar src={r.user?.avatar} size={36}>{r.name?.[0]}</Avatar>
          <span>{r.name}</span>
        </Space>
      ),
    },
    {
      title: '微信昵称',
      dataIndex: ['user', 'nickname'],
      search: false,
      render: (_, r) => r.user?.nickname || '--',
    },
    {
      title: '联系电话',
      dataIndex: 'phone',
      copyable: true,
      search: false,
    },
    {
      title: '从业年限',
      dataIndex: 'years',
      search: false,
      render: (v) => v ? `${v}年` : '--',
    },
    {
      title: '简介',
      dataIndex: 'bio',
      search: false,
      ellipsis: true,
      render: (v) => v || '--',
    },
    {
      title: '状态',
      dataIndex: 'status',
      valueType: 'select',
      valueEnum: Object.fromEntries(Object.entries(STATUS_TEXT).map(([k, v]) => [k, { text: v }])),
      render: (_, r) => <Tag color={STATUS_COLOR[r.status]}>{STATUS_TEXT[r.status]}</Tag>,
    },
    {
      title: '申请时间',
      dataIndex: 'created_at',
      search: false,
      valueType: 'dateTime',
    },
    {
      title: '操作',
      valueType: 'option',
      render: (_, record) => {
        if (record.status !== 'pending') return null
        return [
          <Button
            key="approve"
            type="link"
            size="small"
            icon={<CheckOutlined />}
            onClick={async () => {
              await approveApplication(record.id)
              message.success('已通过申请，经纪人账号已创建')
              refresh()
            }}
          >
            通过
          </Button>,
          <Button
            key="reject"
            type="link"
            size="small"
            danger
            icon={<CloseOutlined />}
            onClick={() => setRejectTarget(record.id)}
          >
            拒绝
          </Button>,
        ]
      },
    },
  ]

  return (
    <>
      <ProTable<AgentApplication>
        key={tableKey}
        columns={columns}
        request={async (params) => {
          const res = await getApplications({
            page: params.current,
            limit: params.pageSize,
            status: params.status,
          })
          return { data: res.data.list, total: res.data.total, success: true }
        }}
        rowKey="id"
        pagination={{ pageSize: 20 }}
        scroll={{ x: 800 }}
        headerTitle="经纪人申请审核"
        search={{ labelWidth: 'auto' }}
      />

      <ModalForm
        title="填写拒绝原因"
        open={rejectTarget !== null}
        onOpenChange={(open) => { if (!open) setRejectTarget(null) }}
        onFinish={async (values) => {
          if (rejectTarget === null) return true
          await rejectApplication(rejectTarget, values.reason)
          message.success('已拒绝申请')
          setRejectTarget(null)
          refresh()
          return true
        }}
        modalProps={{ destroyOnClose: true }}
        layout="vertical"
      >
        <ProFormTextArea name="reason" label="拒绝原因" rules={[{ required: true }]} fieldProps={{ rows: 3 }} />
      </ModalForm>
    </>
  )
}

import React, { useState } from 'react'
import { ProTable, ProColumns } from '@ant-design/pro-components'
import { Tag, Button, message, Select } from 'antd'
import { getAppointments, updateAppointmentStatus, Appointment } from '../../api/appointment'

const STATUS_COLOR: Record<string, string> = {
  pending: 'orange',
  confirmed: 'green',
  cancelled: 'default',
  completed: 'blue',
}
const STATUS_TEXT: Record<string, string> = {
  pending: '待确认',
  confirmed: '已确认',
  cancelled: '已取消',
  completed: '已完成',
}

export default function AppointmentsPage() {
  const [tableKey, setTableKey] = useState(0)
  const refresh = () => setTableKey(k => k + 1)

  const columns: ProColumns<Appointment>[] = [
    {
      title: '房源',
      dataIndex: ['property', 'title'],
      search: false,
      ellipsis: true,
    },
    {
      title: '用户',
      dataIndex: ['user', 'nickname'],
      search: false,
    },
    {
      title: '用户电话',
      dataIndex: ['user', 'phone'],
      search: false,
      copyable: true,
    },
    {
      title: '经纪人',
      dataIndex: ['agent', 'name'],
      search: false,
      render: (_, r) => r.agent?.name || '--',
    },
    {
      title: '预约时间',
      dataIndex: 'scheduled_at',
      search: false,
      valueType: 'dateTime',
    },
    {
      title: '状态',
      dataIndex: 'status',
      valueType: 'select',
      valueEnum: Object.fromEntries(Object.entries(STATUS_TEXT).map(([k, v]) => [k, { text: v }])),
      render: (_, r) => <Tag color={STATUS_COLOR[r.status]}>{STATUS_TEXT[r.status]}</Tag>,
    },
    {
      title: '备注',
      dataIndex: 'note',
      search: false,
      ellipsis: true,
      render: (v) => v || '--',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      search: false,
      valueType: 'dateTime',
      hideInTable: true,
    },
    {
      title: '操作',
      valueType: 'option',
      render: (_, record) => {
        if (record.status !== 'pending') return null
        return [
          <Button
            key="confirm"
            type="link"
            size="small"
            onClick={async () => {
              await updateAppointmentStatus(record.id, 'confirmed')
              message.success('已确认')
              refresh()
            }}
          >
            确认
          </Button>,
          <Button
            key="cancel"
            type="link"
            size="small"
            danger
            onClick={async () => {
              await updateAppointmentStatus(record.id, 'cancelled')
              message.success('已取消')
              refresh()
            }}
          >
            取消
          </Button>,
          <Button
            key="complete"
            type="link"
            size="small"
            onClick={async () => {
              await updateAppointmentStatus(record.id, 'completed')
              message.success('已标记完成')
              refresh()
            }}
          >
            完成
          </Button>,
        ]
      },
    },
  ]

  return (
    <ProTable<Appointment>
      key={tableKey}
      columns={columns}
      request={async (params) => {
        const res = await getAppointments({
          page: params.current,
          limit: params.pageSize,
          status: params.status,
        })
        return { data: res.data.list, total: res.data.total, success: true }
      }}
      rowKey="id"
      pagination={{ pageSize: 20 }}
      headerTitle="预约管理"
      search={{ labelWidth: 'auto' }}
    />
  )
}

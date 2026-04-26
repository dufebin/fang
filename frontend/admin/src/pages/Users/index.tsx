import React from 'react'
import { ProTable, ProColumns } from '@ant-design/pro-components'
import { Tag, Avatar } from 'antd'
import { getUsers, User } from '../../api/user'

const ROLE_COLOR: Record<string, string> = { user: 'default', agent: 'blue', admin: 'red' }
const ROLE_TEXT: Record<string, string> = { user: '普通用户', agent: '经纪人', admin: '管理员' }

export default function UsersPage() {
  const columns: ProColumns<User>[] = [
    {
      title: '头像',
      dataIndex: 'avatar',
      search: false,
      width: 60,
      render: (_, r) => <Avatar src={r.avatar} size={36}>{r.nickname?.[0]}</Avatar>,
    },
    {
      title: '昵称',
      dataIndex: 'nickname',
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      copyable: true,
      render: (v) => v || '--',
    },
    {
      title: '角色',
      dataIndex: 'role',
      valueType: 'select',
      valueEnum: Object.fromEntries(Object.entries(ROLE_TEXT).map(([k, v]) => [k, { text: v }])),
      render: (_, r) => <Tag color={ROLE_COLOR[r.role]}>{ROLE_TEXT[r.role]}</Tag>,
    },
    {
      title: 'OpenID',
      dataIndex: 'open_id',
      search: false,
      copyable: true,
      ellipsis: true,
    },
    {
      title: '注册时间',
      dataIndex: 'created_at',
      search: false,
      valueType: 'dateTime',
    },
  ]

  return (
    <ProTable<User>
      columns={columns}
      request={async (params) => {
        const res = await getUsers({
          page: params.current,
          limit: params.pageSize,
          keyword: params.nickname,
          role: params.role,
        })
        return { data: res.data.list, total: res.data.total, success: true }
      }}
      rowKey="id"
      pagination={{ pageSize: 20 }}
      headerTitle="用户管理"
      search={{ labelWidth: 'auto' }}
    />
  )
}

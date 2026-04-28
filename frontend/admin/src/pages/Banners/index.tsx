import React, { useState } from 'react'
import {
  ProTable,
  ProColumns,
  ModalForm,
  ProFormText,
  ProFormSelect,
  ProFormDigit,
  ProFormSwitch,
} from '@ant-design/pro-components'
import { Button, Image, Tag, Popconfirm, Space, App } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { getBanners, createBanner, updateBanner, deleteBanner, Banner } from '../../api/content'

export default function BannersPage() {
  const { message } = App.useApp()
  const [tableKey, setTableKey] = useState(0)
  const [editTarget, setEditTarget] = useState<Banner | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const refresh = () => setTableKey(k => k + 1)

  const columns: ProColumns<Banner>[] = [
    {
      title: '图片',
      dataIndex: 'image_url',
      search: false,
      width: 120,
      render: (_, r) => <Image src={r.image_url} width={100} height={56} style={{ objectFit: 'cover', borderRadius: 4 }} />,
    },
    {
      title: '标题',
      dataIndex: 'title',
    },
    {
      title: '位置',
      dataIndex: 'position',
      valueType: 'select',
      valueEnum: { home: { text: '首页' }, property_list: { text: '找房页' } },
      render: (_, r) => <Tag>{r.position === 'home' ? '首页' : '找房页'}</Tag>,
    },
    {
      title: '链接类型',
      dataIndex: 'link_type',
      search: false,
      render: (_, r) => r.link_type === 'none' ? '--' : r.link_type,
    },
    {
      title: '链接值',
      dataIndex: 'link_value',
      search: false,
      render: (v) => v || '--',
    },
    {
      title: '排序',
      dataIndex: 'sort_order',
      search: false,
    },
    {
      title: '启用',
      dataIndex: 'is_active',
      search: false,
      render: (_, r) => <Tag color={r.is_active ? 'green' : 'default'}>{r.is_active ? '启用' : '停用'}</Tag>,
    },
    {
      title: '操作',
      valueType: 'option',
      render: (_, record) => [
        <Button key="edit" type="link" size="small" onClick={() => setEditTarget(record)}>编辑</Button>,
        <Popconfirm
          key="del"
          title="确认删除此横幅？"
          onConfirm={async () => {
            await deleteBanner(record.id)
            message.success('已删除')
            refresh()
          }}
        >
          <Button type="link" size="small" danger>删除</Button>
        </Popconfirm>,
      ],
    },
  ]

  const BannerForm = ({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: Banner | null }) => (
    <ModalForm
      title={initial ? '编辑横幅' : '新建横幅'}
      open={open}
      onOpenChange={(v) => { if (!v) onClose() }}
      initialValues={initial || { position: 'home', link_type: 'none', sort_order: 0, is_active: true }}
      onFinish={async (values) => {
        if (initial) {
          await updateBanner(initial.id, values)
          message.success('已更新')
        } else {
          await createBanner(values)
          message.success('已创建')
        }
        onClose()
        refresh()
        return true
      }}
      layout="vertical"
      modalProps={{ destroyOnHidden: true }}
    >
      <ProFormText name="title" label="标题" rules={[{ required: true }]} />
      <ProFormText name="image_url" label="图片URL" rules={[{ required: true }]} />
      <ProFormSelect name="position" label="展示位置" options={[{ label: '首页', value: 'home' }, { label: '找房页', value: 'property_list' }]} rules={[{ required: true }]} />
      <ProFormSelect name="link_type" label="点击跳转类型" options={[
        { label: '无跳转', value: 'none' },
        { label: '房源详情', value: 'property' },
        { label: '文章详情', value: 'article' },
        { label: '外部链接', value: 'url' },
      ]} />
      <ProFormText name="link_value" label="跳转值（ID或URL）" />
      <ProFormDigit name="sort_order" label="排序（越小越前）" min={0} />
      <ProFormSwitch name="is_active" label="启用" />
    </ModalForm>
  )

  return (
    <>
      <ProTable<Banner>
        key={tableKey}
        columns={columns}
        request={async (params) => {
          const res = await getBanners({ position: params.position })
          return { data: res.data || [], total: (res.data || []).length, success: true }
        }}
        rowKey="id"
        pagination={false}
        headerTitle="横幅管理"
        toolBarRender={() => [
          <Button key="create" type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            新建横幅
          </Button>,
        ]}
      />

      <BannerForm open={createOpen} onClose={() => setCreateOpen(false)} />
      <BannerForm open={!!editTarget} onClose={() => setEditTarget(null)} initial={editTarget} />
    </>
  )
}

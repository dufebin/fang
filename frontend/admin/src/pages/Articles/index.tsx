import React, { useState } from 'react'
import {
  ProTable,
  ProColumns,
  ModalForm,
  ProFormText,
  ProFormSelect,
  ProFormTextArea,
} from '@ant-design/pro-components'
import { Button, Tag, message, Popconfirm } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { getArticles, createArticle, updateArticle, deleteArticle, Article } from '../../api/content'

const CATEGORIES = ['市场动态', '购房指南', '政策解读', '装修百科', '社区活动', '其他']

export default function ArticlesPage() {
  const [tableKey, setTableKey] = useState(0)
  const [editTarget, setEditTarget] = useState<Article | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const refresh = () => setTableKey(k => k + 1)

  const columns: ProColumns<Article>[] = [
    {
      title: '标题',
      dataIndex: 'title',
      ellipsis: true,
    },
    {
      title: '分类',
      dataIndex: 'category',
      valueType: 'select',
      valueEnum: Object.fromEntries(CATEGORIES.map(c => [c, { text: c }])),
      render: (_, r) => <Tag color="blue">{r.category}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      valueType: 'select',
      valueEnum: { draft: { text: '草稿' }, published: { text: '已发布' } },
      render: (_, r) => <Tag color={r.status === 'published' ? 'green' : 'default'}>
        {r.status === 'published' ? '已发布' : '草稿'}
      </Tag>,
    },
    {
      title: '浏览量',
      dataIndex: 'view_count',
      search: false,
    },
    {
      title: '发布时间',
      dataIndex: 'published_at',
      search: false,
      valueType: 'dateTime',
      render: (v) => v || '--',
    },
    {
      title: '操作',
      valueType: 'option',
      render: (_, record) => [
        <Button key="edit" type="link" size="small" onClick={() => setEditTarget(record)}>编辑</Button>,
        <Popconfirm
          key="del"
          title="确认删除此文章？"
          onConfirm={async () => {
            await deleteArticle(record.id)
            message.success('已删除')
            refresh()
          }}
        >
          <Button type="link" size="small" danger>删除</Button>
        </Popconfirm>,
      ],
    },
  ]

  const ArticleForm = ({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: Article | null }) => (
    <ModalForm
      title={initial ? '编辑文章' : '新建文章'}
      open={open}
      onOpenChange={(v) => { if (!v) onClose() }}
      initialValues={initial || { status: 'draft' }}
      onFinish={async (values) => {
        if (initial) {
          await updateArticle(initial.id, values)
          message.success('已更新')
        } else {
          await createArticle(values)
          message.success('已创建')
        }
        onClose()
        refresh()
        return true
      }}
      layout="vertical"
      modalProps={{ destroyOnClose: true }}
      width={700}
    >
      <ProFormText name="title" label="标题" rules={[{ required: true }]} />
      <ProFormSelect name="category" label="分类" options={CATEGORIES.map(c => ({ label: c, value: c }))} rules={[{ required: true }]} />
      <ProFormSelect
        name="status"
        label="状态"
        options={[{ label: '草稿', value: 'draft' }, { label: '发布', value: 'published' }]}
        rules={[{ required: true }]}
      />
      <ProFormText name="cover_image" label="封面图片URL" />
      <ProFormTextArea name="content" label="正文内容（支持HTML）" rules={[{ required: true }]} fieldProps={{ rows: 10 }} />
    </ModalForm>
  )

  return (
    <>
      <ProTable<Article>
        key={tableKey}
        columns={columns}
        request={async (params) => {
          const res = await getArticles({
            page: params.current,
            limit: params.pageSize,
            status: params.status,
            keyword: params.title,
          })
          return { data: res.data.list, total: res.data.total, success: true }
        }}
        rowKey="id"
        pagination={{ pageSize: 20 }}
        headerTitle="文章管理"
        toolBarRender={() => [
          <Button key="create" type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            新建文章
          </Button>,
        ]}
      />

      <ArticleForm open={createOpen} onClose={() => setCreateOpen(false)} />
      <ArticleForm open={!!editTarget} onClose={() => setEditTarget(null)} initial={editTarget} />
    </>
  )
}

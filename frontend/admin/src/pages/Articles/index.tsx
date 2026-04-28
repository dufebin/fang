import React, { useState, useEffect } from 'react'
import { ProTable, ProColumns } from '@ant-design/pro-components'
import { Button, Tag, Popconfirm, Modal, Form, Input, Select, Image, App } from 'antd'
import { PlusOutlined, EyeOutlined } from '@ant-design/icons'
import { Editor, Toolbar } from '@wangeditor/editor-for-react'
import { IDomEditor, IEditorConfig, IToolbarConfig } from '@wangeditor/editor'
import '@wangeditor/editor/dist/css/style.css'
import { getArticles, createArticle, updateArticle, deleteArticle, Article } from '../../api/content'

const CATEGORIES = ['市场动态', '购房指南', '政策解读', '装修百科', '社区活动', '其他']

const toolbarConfig: Partial<IToolbarConfig> = {}
const editorConfig: Partial<IEditorConfig> = { placeholder: '请输入正文内容...' }

function RichEditor({ value, onChange }: { value?: string; onChange?: (v: string) => void }) {
  const [editor, setEditor] = useState<IDomEditor | null>(null)

  useEffect(() => {
    return () => { editor?.destroy() }
  }, [editor])

  return (
    <div style={{ border: '1px solid #d9d9d9', borderRadius: 6, overflow: 'hidden' }}>
      <Toolbar
        editor={editor}
        defaultConfig={toolbarConfig}
        mode="default"
        style={{ borderBottom: '1px solid #d9d9d9' }}
      />
      <Editor
        defaultConfig={editorConfig}
        value={value}
        onCreated={setEditor}
        onChange={e => onChange?.(e.getHtml())}
        mode="default"
        style={{ minHeight: 320, overflowY: 'auto' }}
      />
    </div>
  )
}

function ArticleFormModal({
  open,
  onClose,
  initial,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  initial?: Article | null
  onSaved: () => void
}) {
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)
  const { message } = App.useApp()

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      if (initial) {
        await updateArticle(initial.id, values)
        message.success('已更新')
      } else {
        await createArticle(values)
        message.success('已创建')
      }
      onClose()
      onSaved()
    } catch {
      // validation errors shown inline
    } finally {
      setSubmitting(false)
    }
  }

  // initialValues feeds into Form on fresh mount (destroyOnHidden ensures remount each open)
  const initialValues = initial
    ? { ...initial }
    : { status: 'draft', content: '' }

  return (
    <Modal
      title={initial ? '编辑文章' : '新建文章'}
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      okText="保存"
      cancelText="取消"
      confirmLoading={submitting}
      width={900}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" initialValues={initialValues} style={{ marginTop: 16 }}>
        <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
          <Input placeholder="请输入文章标题" />
        </Form.Item>
        <div style={{ display: 'flex', gap: 16 }}>
          <Form.Item name="category" label="分类" rules={[{ required: true, message: '请选择分类' }]} style={{ flex: 1 }}>
            <Select placeholder="请选择分类" options={CATEGORIES.map(c => ({ label: c, value: c }))} />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true }]} style={{ flex: 1 }}>
            <Select options={[{ label: '草稿', value: 'draft' }, { label: '发布', value: 'published' }]} />
          </Form.Item>
        </div>
        <Form.Item name="cover_image" label="封面图片URL" extra="填入图片地址，留空则无封面">
          <Input placeholder="https://..." />
        </Form.Item>
        <Form.Item name="content" label="正文内容" rules={[{ required: true, message: '请输入正文内容' }]}>
          <RichEditor />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default function ArticlesPage() {
  const [tableKey, setTableKey] = useState(0)
  const [editTarget, setEditTarget] = useState<Article | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const { message } = App.useApp()
  const refresh = () => setTableKey(k => k + 1)

  const columns: ProColumns<Article>[] = [
    {
      title: '封面',
      dataIndex: 'cover_image',
      search: false,
      width: 80,
      render: (_, r) =>
        r.cover_image ? (
          <Image src={r.cover_image} width={60} height={40} style={{ objectFit: 'cover', borderRadius: 4 }} preview={{ mask: <EyeOutlined /> }} />
        ) : (
          <div style={{ width: 60, height: 40, background: '#f5f5f5', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#bbb' }}>无图</div>
        ),
    },
    { title: '标题', dataIndex: 'title', ellipsis: true, copyable: true },
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
      render: (_, r) => (
        <Tag color={r.status === 'published' ? 'green' : 'default'}>
          {r.status === 'published' ? '已发布' : '草稿'}
        </Tag>
      ),
    },
    { title: '浏览量', dataIndex: 'view_count', search: false, sorter: true },
    {
      title: '发布时间',
      dataIndex: 'published_at',
      search: false,
      valueType: 'dateTime',
      width: 160,
      render: (v) => v || '--',
    },
    {
      title: '操作',
      valueType: 'option',
      width: 120,
      render: (_, record) => [
        <Button key="edit" type="link" size="small" onClick={() => setEditTarget(record)}>编辑</Button>,
        <Popconfirm
          key="del"
          title="确认删除此文章？"
          onConfirm={async () => { await deleteArticle(record.id); message.success('已删除'); refresh() }}
        >
          <Button type="link" size="small" danger>删除</Button>
        </Popconfirm>,
      ],
    },
  ]

  return (
    <>
      <ProTable<Article>
        key={tableKey}
        columns={columns}
        request={async (params) => {
          const res = await getArticles({ page: params.current, limit: params.pageSize, status: params.status, keyword: params.title })
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
        scroll={{ x: 900 }}
      />

      <ArticleFormModal open={createOpen} onClose={() => setCreateOpen(false)} onSaved={refresh} />
      <ArticleFormModal open={!!editTarget} onClose={() => setEditTarget(null)} initial={editTarget} onSaved={refresh} />
    </>
  )
}

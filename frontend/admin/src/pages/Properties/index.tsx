import React, { useState } from 'react'
import {
  ProTable,
  ProColumns,
  ModalForm,
  ProFormText,
  ProFormSelect,
  ProFormDigit,
  ProFormTextArea,
} from '@ant-design/pro-components'
import { Button, Space, Tag, message, Upload, Popconfirm, Drawer, Form, Input, Select, InputNumber, Row, Col } from 'antd'
import { PlusOutlined, UploadOutlined, EditOutlined } from '@ant-design/icons'
import {
  getProperties,
  createProperty,
  updateProperty,
  updatePropertyStatus,
  uploadPropertyImage,
  Property,
} from '../../api/property'

const STATUS_MAP: Record<string, { text: string; color: string }> = {
  available: { text: '在售', color: 'success' },
  sold: { text: '已售', color: 'default' },
  rented: { text: '已租', color: 'blue' },
  offline: { text: '已下架', color: 'red' },
}

const PROPERTY_TYPES = ['新房', '二手房', '租房', '商铺']
const DECORATIONS = ['毛坯', '简装', '精装', '豪华装修']

export default function PropertiesPage() {
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [editDrawerOpen, setEditDrawerOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Property | null>(null)
  const [currentId, setCurrentId] = useState<number | null>(null)
  const [tableKey, setTableKey] = useState(0)
  const [editForm] = Form.useForm()
  const refresh = () => setTableKey(k => k + 1)

  const openEdit = (record: Property) => {
    setEditTarget(record)
    editForm.setFieldsValue(record)
    setEditDrawerOpen(true)
  }

  const handleEditSubmit = async () => {
    if (!editTarget) return
    try {
      const values = await editForm.validateFields()
      await updateProperty(editTarget.id, values)
      message.success('房源已更新')
      setEditDrawerOpen(false)
      refresh()
    } catch {
      // validation errors shown inline
    }
  }

  const columns: ProColumns<Property>[] = [
    {
      title: '封面',
      dataIndex: 'cover_image',
      search: false,
      width: 80,
      render: (_, record) =>
        record.cover_image ? (
          <img src={record.cover_image} style={{ width: 60, height: 45, objectFit: 'cover', borderRadius: 4 }} />
        ) : (
          <div style={{ width: 60, height: 45, background: '#f0f0f0', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#999' }}>
            无图
          </div>
        ),
    },
    { title: '标题', dataIndex: 'title', copyable: true, ellipsis: true },
    {
      title: '类型',
      dataIndex: 'property_type',
      valueType: 'select',
      valueEnum: Object.fromEntries(PROPERTY_TYPES.map(v => [v, { text: v }])),
    },
    { title: '区域', dataIndex: 'district' },
    { title: '面积(㎡)', dataIndex: 'area', search: false },
    {
      title: '价格',
      dataIndex: 'total_price',
      search: false,
      render: (_, r) => r.total_price ? `${r.total_price}万` : r.monthly_rent ? `${r.monthly_rent}元/月` : '面议',
    },
    { title: '浏览量', dataIndex: 'view_count', search: false, sorter: true },
    {
      title: '状态',
      dataIndex: 'status',
      render: (_, record) => {
        const info = STATUS_MAP[record.status] || { text: '未知', color: 'default' }
        return <Tag color={info.color}>{info.text}</Tag>
      },
      valueType: 'select',
      valueEnum: Object.fromEntries(Object.entries(STATUS_MAP).map(([k, v]) => [k, { text: v.text }])),
    },
    {
      title: '操作',
      valueType: 'option',
      width: 200,
      render: (_, record) => [
        <Button key="edit" type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>
          编辑
        </Button>,
        <Button
          key="images"
          type="link"
          size="small"
          onClick={() => { setCurrentId(record.id); setUploadModalOpen(true) }}
        >
          上传图片
        </Button>,
        record.status !== 'offline' ? (
          <Popconfirm
            key="offline"
            title="确认下架此房源？"
            onConfirm={async () => { await updatePropertyStatus(record.id, 'offline'); message.success('已下架'); refresh() }}
          >
            <Button type="link" size="small" danger>下架</Button>
          </Popconfirm>
        ) : (
          <Button
            key="available"
            type="link"
            size="small"
            onClick={async () => { await updatePropertyStatus(record.id, 'available'); message.success('已上架'); refresh() }}
          >
            上架
          </Button>
        ),
      ],
    },
  ]

  const handleCreate = async (values: Record<string, unknown>) => {
    const fd = new FormData()
    Object.entries(values).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') fd.append(k, String(v))
    })
    await createProperty(fd)
    message.success('房源创建成功')
    refresh()
    return true
  }

  const handleUploadImage = async (file: File) => {
    if (!currentId) return false
    const fd = new FormData()
    fd.append('image', file)
    await uploadPropertyImage(currentId, fd)
    message.success('图片上传成功')
    return false
  }

  return (
    <>
      <ProTable<Property>
        key={tableKey}
        columns={columns}
        request={async (params) => {
          const res = await getProperties({
            page: params.current,
            limit: params.pageSize,
            type: params.property_type,
            district: params.district,
            status: params.status,
            keyword: params.title,
          })
          return { data: res.data.list, total: res.data.total, success: true }
        }}
        rowKey="id"
        pagination={{ pageSize: 20 }}
        headerTitle="房源管理"
        toolBarRender={() => [
          <Button key="create" type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            新增房源
          </Button>,
        ]}
        scroll={{ x: 1100 }}
      />

      {/* 新增房源弹窗 */}
      <ModalForm
        title="新增房源"
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onFinish={handleCreate}
        modalProps={{ destroyOnClose: true }}
        layout="vertical"
        grid
      >
        <ProFormText name="title" label="房源标题" rules={[{ required: true }]} colProps={{ span: 24 }} />
        <ProFormSelect name="property_type" label="房源类型" rules={[{ required: true }]} options={PROPERTY_TYPES.map(v => ({ label: v, value: v }))} colProps={{ span: 12 }} />
        <ProFormText name="city" label="城市" rules={[{ required: true }]} colProps={{ span: 12 }} />
        <ProFormText name="district" label="区域" rules={[{ required: true }]} colProps={{ span: 12 }} />
        <ProFormText name="address" label="详细地址" colProps={{ span: 12 }} />
        <ProFormDigit name="area" label="建筑面积(㎡)" rules={[{ required: true }]} colProps={{ span: 8 }} />
        <ProFormDigit name="total_price" label="总价(万元)" colProps={{ span: 8 }} />
        <ProFormDigit name="monthly_rent" label="月租金(元)" colProps={{ span: 8 }} />
        <ProFormDigit name="unit_price" label="单价(元/㎡)" colProps={{ span: 8 }} />
        <ProFormDigit name="bedrooms" label="卧室(间)" initialValue={2} colProps={{ span: 8 }} />
        <ProFormDigit name="living_rooms" label="客厅(间)" initialValue={1} colProps={{ span: 8 }} />
        <ProFormDigit name="bathrooms" label="卫生间" initialValue={1} colProps={{ span: 8 }} />
        <ProFormDigit name="floor" label="所在楼层" colProps={{ span: 8 }} />
        <ProFormDigit name="total_floors" label="总楼层" colProps={{ span: 8 }} />
        <ProFormSelect name="decoration" label="装修" options={DECORATIONS.map(v => ({ label: v, value: v }))} initialValue="精装" colProps={{ span: 12 }} />
        <ProFormText name="direction" label="朝向" colProps={{ span: 12 }} />
        <ProFormTextArea name="description" label="房源描述" colProps={{ span: 24 }} fieldProps={{ rows: 4 }} />
      </ModalForm>

      {/* 编辑房源抽屉 */}
      <Drawer
        title="编辑房源"
        open={editDrawerOpen}
        onClose={() => setEditDrawerOpen(false)}
        width={640}
        footer={
          <Space style={{ float: 'right' }}>
            <Button onClick={() => setEditDrawerOpen(false)}>取消</Button>
            <Button type="primary" onClick={handleEditSubmit}>保存</Button>
          </Space>
        }
        destroyOnClose
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="title" label="房源标题" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="property_type" label="房源类型" rules={[{ required: true }]}>
                <Select options={PROPERTY_TYPES.map(v => ({ label: v, value: v }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="decoration" label="装修">
                <Select options={DECORATIONS.map(v => ({ label: v, value: v }))} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="city" label="城市" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="district" label="区域" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="address" label="详细地址">
            <Input />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="area" label="面积(㎡)" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="total_price" label="总价(万元)">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="monthly_rent" label="月租金(元)">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="bedrooms" label="卧室(间)">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="living_rooms" label="客厅(间)">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="bathrooms" label="卫生间">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="floor" label="所在楼层">
                <InputNumber style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="total_floors" label="总楼层">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="direction" label="朝向">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="房源描述">
            <Input.TextArea rows={5} />
          </Form.Item>
        </Form>
      </Drawer>

      {/* 上传图片弹窗 */}
      <ModalForm
        title="上传房源图片"
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        onFinish={async () => true}
        submitter={false}
      >
        <Upload.Dragger multiple beforeUpload={handleUploadImage} accept="image/*" listType="picture">
          <p><UploadOutlined style={{ fontSize: 32, color: '#1677ff' }} /></p>
          <p>点击或拖拽图片到此区域上传</p>
          <p style={{ color: '#999', fontSize: 12 }}>支持 JPG、PNG、WebP，第一张自动设为封面</p>
        </Upload.Dragger>
      </ModalForm>
    </>
  )
}

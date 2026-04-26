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
import { Button, Space, Tag, message, Upload, Popconfirm } from 'antd'
import { PlusOutlined, UploadOutlined } from '@ant-design/icons'
import { getProperties, createProperty, updatePropertyStatus, uploadPropertyImage, Property } from '../../api/property'

const STATUS_MAP: Record<string, { text: string; color: string }> = {
  available: { text: '在售', color: 'success' },
  sold: { text: '已售', color: 'default' },
  rented: { text: '已租', color: 'blue' },
  offline: { text: '已下架', color: 'red' },
}

export default function PropertiesPage() {
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [currentId, setCurrentId] = useState<number | null>(null)
  const [tableKey, setTableKey] = useState(0)

  const columns: ProColumns<Property>[] = [
    {
      title: '封面',
      dataIndex: 'cover_image',
      search: false,
      render: (_, record) => (
        record.cover_image
          ? <img src={record.cover_image} style={{ width: 60, height: 45, objectFit: 'cover', borderRadius: 4 }} />
          : <div style={{ width: 60, height: 45, background: '#f0f0f0', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#999' }}>无图</div>
      ),
    },
    {
      title: '标题',
      dataIndex: 'title',
      copyable: true,
      ellipsis: true,
    },
    {
      title: '类型',
      dataIndex: 'property_type',
      valueType: 'select',
      valueEnum: {
        '新房': { text: '新房' },
        '二手房': { text: '二手房' },
        '租房': { text: '租房' },
        '商铺': { text: '商铺' },
      },
    },
    {
      title: '区域',
      dataIndex: 'district',
    },
    {
      title: '面积(㎡)',
      dataIndex: 'area',
      search: false,
    },
    {
      title: '总价(万)',
      dataIndex: 'total_price',
      search: false,
      render: (_, r) => r.total_price ?? (r.monthly_rent ? `${r.monthly_rent}元/月` : '面议'),
    },
    {
      title: '浏览量',
      dataIndex: 'view_count',
      search: false,
      sorter: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (_, record) => {
        const info = STATUS_MAP[record.status] || { text: '未知', color: 'default' }
        return <Tag color={info.color}>{info.text}</Tag>
      },
      valueType: 'select',
      valueEnum: Object.fromEntries(
        Object.entries(STATUS_MAP).map(([k, v]) => [k, { text: v.text }])
      ),
    },
    {
      title: '操作',
      valueType: 'option',
      render: (_, record) => [
        <Button
          key="images"
          type="link"
          size="small"
          onClick={() => { setCurrentId(record.id); setUploadModalOpen(true) }}
        >
          上传图片
        </Button>,
        <Popconfirm
          key="offline"
          title="确认下架此房源？"
          onConfirm={async () => {
            await updatePropertyStatus(record.id, 'offline')
            message.success('已下架')
            setTableKey(k => k + 1)
          }}
          disabled={record.status === 'offline'}
        >
          <Button type="link" size="small" danger disabled={record.status === 'offline'}>
            下架
          </Button>
        </Popconfirm>,
        <Button
          key="available"
          type="link"
          size="small"
          disabled={record.status === 'available'}
          onClick={async () => {
            await updatePropertyStatus(record.id, 'available')
            message.success('已上架')
            setTableKey(k => k + 1)
          }}
        >
          上架
        </Button>,
      ],
    },
  ]

  const handleCreate = async (values: Record<string, unknown>) => {
    const fd = new FormData()
    Object.entries(values).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        fd.append(k, String(v))
      }
    })
    await createProperty(fd)
    message.success('房源创建成功')
    setTableKey(k => k + 1)
    return true
  }

  const handleUploadImage = async (file: File) => {
    if (!currentId) return false
    const fd = new FormData()
    fd.append('image', file)
    await uploadPropertyImage(currentId, fd)
    message.success('图片上传成功')
    return false // 阻止antd默认上传
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
          return {
            data: res.data.list,
            total: res.data.total,
            success: true,
          }
        }}
        rowKey="id"
        pagination={{ pageSize: 20 }}
        headerTitle="房源管理"
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalOpen(true)}
          >
            新增房源
          </Button>,
        ]}
        scroll={{ x: 1000 }}
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
        <ProFormSelect
          name="property_type"
          label="房源类型"
          rules={[{ required: true }]}
          options={['新房', '二手房', '租房', '商铺'].map(v => ({ label: v, value: v }))}
          colProps={{ span: 12 }}
        />
        <ProFormText name="city" label="城市" rules={[{ required: true }]} colProps={{ span: 12 }} />
        <ProFormText name="district" label="区域" rules={[{ required: true }]} colProps={{ span: 12 }} />
        <ProFormText name="address" label="详细地址" colProps={{ span: 12 }} />
        <ProFormDigit name="area" label="建筑面积(㎡)" rules={[{ required: true }]} colProps={{ span: 8 }} />
        <ProFormDigit name="total_price" label="总价(万元)" colProps={{ span: 8 }} />
        <ProFormDigit name="monthly_rent" label="月租金(元)" colProps={{ span: 8 }} />
        <ProFormDigit name="bedrooms" label="卧室" initialValue={2} colProps={{ span: 6 }} />
        <ProFormDigit name="living_rooms" label="客厅" initialValue={1} colProps={{ span: 6 }} />
        <ProFormDigit name="bathrooms" label="卫生间" initialValue={1} colProps={{ span: 6 }} />
        <ProFormDigit name="area" label="面积" colProps={{ span: 6 }} />
        <ProFormSelect
          name="decoration"
          label="装修"
          options={['毛坯', '简装', '精装', '豪华装修'].map(v => ({ label: v, value: v }))}
          initialValue="精装"
          colProps={{ span: 12 }}
        />
        <ProFormText name="direction" label="朝向" colProps={{ span: 12 }} />
        <ProFormTextArea name="description" label="房源描述" colProps={{ span: 24 }} fieldProps={{ rows: 4 }} />
      </ModalForm>

      {/* 上传图片弹窗 */}
      <ModalForm
        title="上传房源图片"
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        onFinish={async () => true}
        submitter={false}
      >
        <Upload.Dragger
          multiple
          beforeUpload={handleUploadImage}
          accept="image/*"
          listType="picture"
        >
          <p><UploadOutlined style={{ fontSize: 32, color: '#1677ff' }} /></p>
          <p>点击或拖拽图片到此区域上传</p>
          <p style={{ color: '#999', fontSize: 12 }}>支持 JPG、PNG、WebP，第一张自动设为封面</p>
        </Upload.Dragger>
      </ModalForm>
    </>
  )
}

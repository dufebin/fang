import React, { useState, useEffect } from 'react'
import { ProTable, ProColumns, ModalForm } from '@ant-design/pro-components'
import {
  Button, Space, Tag, Upload, Popconfirm, Drawer,
  Form, Input, Select, InputNumber, Row, Col, Image, App, AutoComplete,
} from 'antd'
import { PlusOutlined, UploadOutlined, EditOutlined, SearchOutlined } from '@ant-design/icons'
import { Editor, Toolbar } from '@wangeditor/editor-for-react'
import { IDomEditor, IEditorConfig, IToolbarConfig } from '@wangeditor/editor'
import { pinyin } from 'pinyin-pro'
import AddressParse from 'address-parse-cn'
import '@wangeditor/editor/dist/css/style.css'
import {
  getProperties, createProperty, updateProperty,
  updatePropertyStatus, uploadPropertyImage, Property,
} from '../../api/property'
import { CITY_DISTRICTS, MAJOR_CITIES } from '../../data/cityDistricts'

const STATUS_MAP: Record<string, { text: string; color: string }> = {
  available: { text: '在售', color: 'success' },
  sold: { text: '已售', color: 'default' },
  rented: { text: '已租', color: 'blue' },
  offline: { text: '已下架', color: 'red' },
}

const PROPERTY_TYPES = ['新房', '二手房', '租房', '商铺']
const DECORATIONS = ['毛坯', '简装', '精装', '豪华装修']

const CITY_OPTIONS = MAJOR_CITIES.map(c => ({ value: c }))

function districtOptions(city: string) {
  return (CITY_DISTRICTS[city] ?? []).map(d => ({ value: d }))
}

// 支持汉字包含、全拼包含、首字母前缀三种方式匹配
function pinyinMatch(text: string, query: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  if (text.includes(query)) return true
  const full = pinyin(text, { toneType: 'none', separator: '' }).toLowerCase()
  if (full.includes(q)) return true
  const initials = pinyin(text, { toneType: 'none', pattern: 'initial', separator: '' }).toLowerCase()
  return initials.startsWith(q)
}

function parseChineseAddress(input: string) {
  const [result] = (AddressParse as any).parse(input) as any[]
  if (!result) return { province: '', city: '', district: '', address: input }
  return {
    province: (result.province as string || '').replace(/省$|市$/, ''),
    city: (result.city as string || '').replace(/市$/, ''),
    district: (result.area as string || '').replace(/[区县]$/, ''),
    address: result.details as string || '',
  }
}

const toolbarConfig: Partial<IToolbarConfig> = {}
const editorConfig: Partial<IEditorConfig> = { placeholder: '请输入房源描述...' }

function RichEditor({ value, onChange }: { value?: string; onChange?: (v: string) => void }) {
  const [editor, setEditor] = useState<IDomEditor | null>(null)
  useEffect(() => { return () => { editor?.destroy() } }, [editor])
  return (
    <div style={{ border: '1px solid #d9d9d9', borderRadius: 6, overflow: 'hidden' }}>
      <Toolbar editor={editor} defaultConfig={toolbarConfig} mode="default" style={{ borderBottom: '1px solid #d9d9d9' }} />
      <Editor defaultConfig={editorConfig} value={value} onCreated={setEditor} onChange={e => onChange?.(e.getHtml())} mode="default" style={{ minHeight: 240, overflowY: 'auto' }} />
    </div>
  )
}

export default function PropertiesPage() {
  const { message } = App.useApp()
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editDrawerOpen, setEditDrawerOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Property | null>(null)
  const [tableKey, setTableKey] = useState(0)
  const [editForm] = Form.useForm()
  const [createForm] = Form.useForm()
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState('')
  const [editCoverPreview, setEditCoverPreview] = useState('')
  const [createCity, setCreateCity] = useState('')
  const [editCity, setEditCity] = useState('')
  const [createParseInput, setCreateParseInput] = useState('')
  const [editParseInput, setEditParseInput] = useState('')
  const refresh = () => setTableKey(k => k + 1)

  function applyAddressParse(input: string, form: typeof createForm, setCity: (v: string) => void) {
    const { province, city, district, address } = parseChineseAddress(input)
    if (province) form.setFieldValue('province', province)
    if (city) { form.setFieldValue('city', city); setCity(city) }
    if (district) form.setFieldValue('district', district)
    if (address) form.setFieldValue('address', address)
  }

  function recalcUnitPrice(form: typeof createForm, area?: number | null, totalPrice?: number | null) {
    const a = area ?? form.getFieldValue('area')
    const p = totalPrice ?? form.getFieldValue('total_price')
    if (a && p) {
      form.setFieldValue('unit_price', Math.round(p * 10000 / a))
    } else {
      form.setFieldValue('unit_price', undefined)
    }
  }

  const openEdit = (record: Property) => {
    setEditTarget(record)
    editForm.setFieldsValue(record)
    setEditCoverPreview(record.cover_image || '')
    setEditCity(record.city || '')
    setEditParseInput('')
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

  const handleCreate = async (values: Record<string, unknown>) => {
    const fd = new FormData()
    Object.entries(values).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') fd.append(k, String(v))
    })
    const res: any = await createProperty(fd)
    const newId = res.data?.id
    if (coverFile && newId) {
      const imgFd = new FormData()
      imgFd.append('image', coverFile)
      const imgRes: any = await uploadPropertyImage(newId, imgFd)
      const imgUrl = imgRes.data?.url
      if (imgUrl) await updateProperty(newId, { cover_image: imgUrl } as any)
    }
    message.success('房源创建成功')
    setCoverFile(null)
    setCoverPreview('')
    refresh()
    return true
  }

  const columns: ProColumns<Property>[] = [
    {
      title: '封面',
      dataIndex: 'cover_image',
      search: false,
      width: 80,
      render: (_, record) =>
        record.cover_image ? (
          <Image src={record.cover_image} width={60} height={45} style={{ objectFit: 'cover', borderRadius: 4 }} />
        ) : (
          <div style={{ width: 60, height: 45, background: '#f5f5f5', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#bbb' }}>
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
      width: 160,
      render: (_, record) => [
        <Button key="edit" type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>
          编辑
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
        onOpenChange={(v) => {
          if (!v) { setCoverFile(null); setCoverPreview(''); setCreateCity(''); setCreateParseInput(''); createForm.resetFields() }
          setCreateModalOpen(v)
        }}
        onFinish={handleCreate}
        form={createForm}
        modalProps={{ destroyOnHidden: true, width: 720 }}
        layout="vertical"
      >
        <Form.Item name="title" label="房源标题" rules={[{ required: true }]}>
          <Input />
        </Form.Item>

        <Form.Item label="封面图片">
          {coverPreview && (
            <div style={{ marginBottom: 8 }}>
              <img src={coverPreview} alt="封面预览" style={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 6, border: '1px solid #f0f0f0' }} />
            </div>
          )}
          <Upload
            accept="image/*"
            showUploadList={false}
            beforeUpload={(file) => {
              setCoverFile(file)
              setCoverPreview(URL.createObjectURL(file))
              return false
            }}
          >
            <Button icon={<UploadOutlined />}>{coverFile ? '重新选择' : '选择封面图片'}</Button>
          </Upload>
        </Form.Item>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="property_type" label="房源类型" rules={[{ required: true }]}>
              <Select options={PROPERTY_TYPES.map(v => ({ label: v, value: v }))} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="decoration" label="装修" initialValue="精装">
              <Select options={DECORATIONS.map(v => ({ label: v, value: v }))} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label="解析地址" extra="粘贴完整地址（如：广东省广州市天河区体育西路123号），点击自动填充">
          <Space.Compact style={{ width: '100%' }}>
            <Input
              placeholder="粘贴完整地址，点击自动填充"
              value={createParseInput}
              onChange={(e) => setCreateParseInput(e.target.value)}
            />
            <Button
              icon={<SearchOutlined />}
              onClick={() => applyAddressParse(createParseInput, createForm, setCreateCity)}
            >
              自动填充
            </Button>
          </Space.Compact>
        </Form.Item>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="province" label="省份">
              <Input placeholder="如：广东" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="city" label="城市" rules={[{ required: true }]}>
              <AutoComplete
                options={CITY_OPTIONS}
                filterOption={(input, option) => pinyinMatch(option?.value as string || '', input)}
                placeholder="输入城市名或拼音"
                onChange={(v) => { setCreateCity(v); createForm.setFieldValue('district', undefined) }}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="district" label="区域" rules={[{ required: true }]}>
              <AutoComplete
                options={districtOptions(createCity)}
                filterOption={(input, option) => pinyinMatch(option?.value as string || '', input)}
                placeholder={createCity ? `选择${createCity}的区域` : '请先选择城市'}
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="address" label="详细地址">
          <Input placeholder="街道/小区/门牌号" />
        </Form.Item>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="area" label="建筑面积(㎡)" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} min={0} onChange={(v) => recalcUnitPrice(createForm, v as number)} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="total_price" label="总价(万元)">
              <InputNumber style={{ width: '100%' }} min={0} onChange={(v) => recalcUnitPrice(createForm, undefined, v as number)} />
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
            <Form.Item name="unit_price" label="单价(元/㎡)">
              <InputNumber style={{ width: '100%' }} min={0} disabled />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="bedrooms" label="卧室(间)" initialValue={2}>
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="living_rooms" label="客厅(间)" initialValue={1}>
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="bathrooms" label="卫生间" initialValue={1}>
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
          </Col>
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
        </Row>

        <Form.Item name="direction" label="朝向">
          <Input />
        </Form.Item>

        <Form.Item name="description" label="房源描述">
          <RichEditor />
        </Form.Item>
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

          <Form.Item label="封面图片">
            {editCoverPreview && (
              <div style={{ marginBottom: 8 }}>
                <img src={editCoverPreview} alt="封面" style={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 6, border: '1px solid #f0f0f0' }} />
              </div>
            )}
            <Upload
              accept="image/*"
              showUploadList={false}
              beforeUpload={async (file) => {
                if (!editTarget) return false
                const fd = new FormData()
                fd.append('image', file)
                try {
                  const res: any = await uploadPropertyImage(editTarget.id, fd)
                  const url = res.data?.url
                  if (url) {
                    editForm.setFieldValue('cover_image', url)
                    setEditCoverPreview(url)
                    message.success('封面已更新')
                  }
                } catch { /* error shown by interceptor */ }
                return false
              }}
            >
              <Button icon={<UploadOutlined />}>上传新封面</Button>
            </Upload>
            <Form.Item name="cover_image" hidden><Input /></Form.Item>
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

          <Form.Item label="解析地址" extra="粘贴完整地址（如：广东省广州市天河区体育西路123号），点击自动填充">
            <Space.Compact style={{ width: '100%' }}>
              <Input
                placeholder="粘贴完整地址，点击自动填充"
                value={editParseInput}
                onChange={(e) => setEditParseInput(e.target.value)}
              />
              <Button
                icon={<SearchOutlined />}
                onClick={() => applyAddressParse(editParseInput, editForm, setEditCity)}
              >
                自动填充
              </Button>
            </Space.Compact>
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="province" label="省份">
                <Input placeholder="如：广东" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="city" label="城市" rules={[{ required: true }]}>
                <AutoComplete
                  options={CITY_OPTIONS}
                  filterOption={(input, option) => pinyinMatch(option?.value as string || '', input)}
                  placeholder="输入城市名或拼音"
                  onChange={(v) => { setEditCity(v); editForm.setFieldValue('district', undefined) }}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="district" label="区域" rules={[{ required: true }]}>
                <AutoComplete
                  options={districtOptions(editCity)}
                  filterOption={(input, option) => pinyinMatch(option?.value as string || '', input)}
                  placeholder={editCity ? `选择${editCity}的区域` : '请先选择城市'}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="address" label="详细地址">
            <Input />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="area" label="面积(㎡)" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} min={0} onChange={(v) => recalcUnitPrice(editForm, v as number)} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="total_price" label="总价(万元)">
                <InputNumber style={{ width: '100%' }} min={0} onChange={(v) => recalcUnitPrice(editForm, undefined, v as number)} />
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
              <Form.Item name="unit_price" label="单价(元/㎡)">
                <InputNumber style={{ width: '100%' }} min={0} disabled />
              </Form.Item>
            </Col>
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
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="bathrooms" label="卫生间">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
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
          </Row>

          <Form.Item name="direction" label="朝向">
            <Input />
          </Form.Item>

          <Form.Item name="description" label="房源描述">
            <RichEditor />
          </Form.Item>
        </Form>
      </Drawer>
    </>
  )
}

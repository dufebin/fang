import React, { useState, useEffect, useRef } from 'react'
import { ProTable, ProColumns, ModalForm } from '@ant-design/pro-components'
import {
  Button, Space, Tag, Upload, Popconfirm, Drawer,
  Form, Input, Select, InputNumber, Row, Col, Image, App, AutoComplete, Spin,
} from 'antd'
import { PlusOutlined, UploadOutlined, EditOutlined, SearchOutlined, DeleteOutlined, VideoCameraOutlined, EnvironmentOutlined } from '@ant-design/icons'
import { Editor, Toolbar } from '@wangeditor/editor-for-react'
import { IDomEditor, IEditorConfig, IToolbarConfig } from '@wangeditor/editor'
import { pinyin } from 'pinyin-pro'
import AddressParse from 'address-parse-cn'
import '@wangeditor/editor/dist/css/style.css'
import {
  getProperties, createProperty, updateProperty,
  updatePropertyStatus, uploadPropertyImage, getPropertyDetail, deletePropertyImage,
  uploadPropertyVideo,
  Property, PropertyImage,
} from '../../api/property'
import { CITY_DISTRICTS, MAJOR_CITIES, PROVINCE_CITIES, PROVINCES } from '../../data/cityDistricts'

const STATUS_MAP: Record<string, { text: string; color: string }> = {
  available: { text: '在售', color: 'success' },
  sold: { text: '已售', color: 'default' },
  rented: { text: '已租', color: 'blue' },
  offline: { text: '已下架', color: 'red' },
}

const PROPERTY_TYPES = ['新房', '二手房', '租房', '商铺']
const DECORATIONS = ['毛坯', '简装', '精装', '豪华装修']

const CITY_OPTIONS = MAJOR_CITIES.map(c => ({ value: c }))
const PROVINCE_OPTIONS = PROVINCES.map(p => ({ value: p }))

function cityOptions(province: string) {
  const cities = PROVINCE_CITIES[province]
  return cities ? cities.map(c => ({ value: c })) : CITY_OPTIONS
}

function districtOptions(city: string) {
  return (CITY_DISTRICTS[city] ?? []).map(d => ({ value: d }))
}

async function detectLocation(): Promise<{ province: string; city: string } | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 4000)
    const res = await fetch('https://ip.useragentinfo.com/json', { signal: controller.signal })
    clearTimeout(timer)
    const data = await res.json()
    if (data.province && data.city) {
      const province = (data.province as string).replace(/省$|市$|自治区.*$|特别行政区$/, '')
      const city = (data.city as string).replace(/市$/, '')
      return { province, city }
    }
  } catch { /* silent */ }
  return null
}

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

interface QueuedFile {
  file: File
  preview: string
}

export default function PropertiesPage() {
  const { message } = App.useApp()
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editDrawerOpen, setEditDrawerOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Property | null>(null)
  const [tableKey, setTableKey] = useState(0)
  const [editForm] = Form.useForm()
  const [createForm] = Form.useForm()

  // Create form media queue
  const [createImageFiles, setCreateImageFiles] = useState<QueuedFile[]>([])
  const [createVideoFile, setCreateVideoFile] = useState<QueuedFile | null>(null)

  // Edit form state
  const [createProvince, setCreateProvince] = useState('')
  const [createCity, setCreateCity] = useState('')
  const [editProvince, setEditProvince] = useState('')
  const [editCity, setEditCity] = useState('')
  const [locating, setLocating] = useState(false)
  const [createParseInput, setCreateParseInput] = useState('')
  const [editParseInput, setEditParseInput] = useState('')
  const [editImages, setEditImages] = useState<PropertyImage[]>([])
  const [editImagesLoading, setEditImagesLoading] = useState(false)
  const [editVideoUrl, setEditVideoUrl] = useState('')

  // Cover highlight animation
  const [highlightFirst, setHighlightFirst] = useState(false)
  const [highlightCover, setHighlightCover] = useState(false)
  const firstImageRef = useRef<HTMLDivElement>(null)
  const coverAreaRef = useRef<HTMLDivElement>(null)

  const refresh = () => setTableKey(k => k + 1)

  function applyAddressParse(input: string, form: typeof createForm, setProvince: (v: string) => void, setCity: (v: string) => void) {
    const { province, city, district, address } = parseChineseAddress(input)
    if (province) { form.setFieldValue('province', province); setProvince(province) }
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

  const openEdit = async (record: Property) => {
    setEditTarget(record)
    editForm.setFieldsValue(record)
    setEditProvince(record.province || '')
    setEditCity(record.city || '')
    setEditParseInput('')
    setEditImages([])
    setEditVideoUrl(record.video_url || '')
    setEditDrawerOpen(true)
    setEditImagesLoading(true)
    try {
      const res: any = await getPropertyDetail(record.id)
      setEditImages(res.data?.images || [])
    } catch {
      // images stay empty
    } finally {
      setEditImagesLoading(false)
    }
  }

  const handleCoverClick = () => {
    if (editImages.length === 0) return
    firstImageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    setHighlightFirst(true)
    setTimeout(() => setHighlightFirst(false), 1500)
  }

  const setCoverImage = (img: PropertyImage) => {
    setEditImages(prev => [img, ...prev.filter(i => i.id !== img.id)])
    coverAreaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    setHighlightCover(true)
    setTimeout(() => setHighlightCover(false), 1500)
  }

  const handleEditSubmit = async () => {
    if (!editTarget) return
    try {
      const values = await editForm.validateFields()
      await updateProperty(editTarget.id, {
        ...values,
        cover_image: editImages[0]?.url || '',
        video_url: editVideoUrl,
      })
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

    if (newId) {
      let firstImageUrl = ''
      for (const { file } of createImageFiles) {
        const imgFd = new FormData()
        imgFd.append('image', file)
        try {
          const imgRes: any = await uploadPropertyImage(newId, imgFd)
          if (!firstImageUrl && imgRes.data?.url) firstImageUrl = imgRes.data.url
        } catch { /* shown by interceptor */ }
      }
      if (firstImageUrl) {
        await updateProperty(newId, { cover_image: firstImageUrl } as any)
      }
      if (createVideoFile) {
        const vFd = new FormData()
        vFd.append('video', createVideoFile.file)
        try {
          await uploadPropertyVideo(newId, vFd)
        } catch { /* shown by interceptor */ }
      }
    }

    createImageFiles.forEach(f => URL.revokeObjectURL(f.preview))
    if (createVideoFile) URL.revokeObjectURL(createVideoFile.preview)
    setCreateImageFiles([])
    setCreateVideoFile(null)
    message.success('房源创建成功')
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
        onOpenChange={async (v) => {
          if (!v) {
            createImageFiles.forEach(f => URL.revokeObjectURL(f.preview))
            if (createVideoFile) URL.revokeObjectURL(createVideoFile.preview)
            setCreateImageFiles([])
            setCreateVideoFile(null)
            setCreateProvince('')
            setCreateCity('')
            setCreateParseInput('')
            createForm.resetFields()
          } else {
            setLocating(true)
            const loc = await detectLocation()
            setLocating(false)
            if (loc) {
              createForm.setFieldValue('province', loc.province)
              setCreateProvince(loc.province)
              const cities = cityOptions(loc.province)
              const matchedCity = cities.find(c => c.value === loc.city)
              if (matchedCity) {
                createForm.setFieldValue('city', loc.city)
                setCreateCity(loc.city)
              }
            }
          }
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

        {/* 媒体文件 */}
        <Form.Item label="媒体文件" extra="第一张图片自动作为封面，可上传多张图片及一个视频">
          {createImageFiles.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              {createImageFiles.map((item, idx) => (
                <div key={idx} style={{ position: 'relative', width: 100 }}>
                  <img
                    src={item.preview}
                    style={{
                      width: 100, height: 75, objectFit: 'cover', borderRadius: 4, display: 'block',
                      border: idx === 0 ? '2px solid #1677ff' : '1px solid #f0f0f0',
                    }}
                  />
                  {idx === 0 && (
                    <div style={{
                      position: 'absolute', top: 2, left: 2, background: '#1677ff',
                      color: '#fff', fontSize: 10, padding: '1px 5px', borderRadius: 3,
                    }}>
                      封面
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: 2 }}>
                    {idx > 0 && (
                      <Button
                        size="small" type="link"
                        style={{ fontSize: 11, padding: '0 4px', color: '#1677ff' }}
                        onClick={() => setCreateImageFiles(prev => [prev[idx], ...prev.filter((_, i) => i !== idx)])}
                      >
                        封面
                      </Button>
                    )}
                    <Button
                      size="small" type="link" danger
                      style={{ padding: '0 4px', fontSize: 11 }}
                      onClick={() => {
                        URL.revokeObjectURL(item.preview)
                        setCreateImageFiles(prev => prev.filter((_, i) => i !== idx))
                      }}
                    >
                      删除
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {createVideoFile && (
            <div style={{ marginBottom: 10 }}>
              <video src={createVideoFile.preview} controls width={200} style={{ borderRadius: 4, display: 'block' }} />
              <Button
                size="small" type="link" danger
                style={{ padding: 0, marginTop: 2 }}
                onClick={() => {
                  URL.revokeObjectURL(createVideoFile.preview)
                  setCreateVideoFile(null)
                }}
              >
                删除视频
              </Button>
            </div>
          )}
          <Space wrap>
            <Upload
              accept="image/*"
              multiple
              showUploadList={false}
              beforeUpload={(file) => {
                setCreateImageFiles(prev => [...prev, { file, preview: URL.createObjectURL(file) }])
                return false
              }}
            >
              <Button icon={<UploadOutlined />}>上传图片</Button>
            </Upload>
            {!createVideoFile && (
              <Upload
                accept="video/*"
                showUploadList={false}
                beforeUpload={(file) => {
                  setCreateVideoFile({ file, preview: URL.createObjectURL(file) })
                  return false
                }}
              >
                <Button icon={<VideoCameraOutlined />}>上传视频</Button>
              </Upload>
            )}
          </Space>
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
              onClick={() => applyAddressParse(createParseInput, createForm, setCreateProvince, setCreateCity)}
            >
              自动填充
            </Button>
          </Space.Compact>
        </Form.Item>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="province" label="省份">
              <AutoComplete
                options={PROVINCE_OPTIONS}
                filterOption={(input, option) => pinyinMatch(option?.value as string || '', input)}
                placeholder="输入省份或拼音"
                onChange={(v) => {
                  setCreateProvince(v)
                  createForm.setFieldValue('city', undefined)
                  createForm.setFieldValue('district', undefined)
                  setCreateCity('')
                }}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="city" label="城市" rules={[{ required: true }]}>
              <AutoComplete
                options={cityOptions(createProvince)}
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

        <Form.Item style={{ marginTop: -16, marginBottom: 8 }}>
          <Button
            size="small"
            icon={<EnvironmentOutlined />}
            loading={locating}
            onClick={async () => {
              setLocating(true)
              const loc = await detectLocation()
              setLocating(false)
              if (loc) {
                createForm.setFieldValue('province', loc.province)
                setCreateProvince(loc.province)
                const cities = cityOptions(loc.province)
                const matchedCity = cities.find(c => c.value === loc.city)
                if (matchedCity) {
                  createForm.setFieldValue('city', loc.city)
                  setCreateCity(loc.city)
                }
                createForm.setFieldValue('district', undefined)
              }
            }}
          >
            重新定位
          </Button>
        </Form.Item>

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

          {/* 图片与视频 */}
          <Form.Item label="图片与视频">
            <Spin spinning={editImagesLoading}>
              {/* 封面预览区 */}
              <div
                ref={coverAreaRef}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12,
                  padding: 10, background: '#fafafa', borderRadius: 6,
                  border: highlightCover ? '2px solid #1677ff' : '1px solid #f0f0f0',
                  transition: 'border 0.3s',
                  cursor: editImages.length > 0 ? 'pointer' : 'default',
                }}
                onClick={handleCoverClick}
                title={editImages.length > 0 ? '点击定位到第一张图片' : ''}
              >
                {editImages[0]?.url ? (
                  <img
                    src={editImages[0].url}
                    style={{ width: 96, height: 68, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
                  />
                ) : (
                  <div style={{
                    width: 96, height: 68, background: '#f0f0f0', borderRadius: 4, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#bbb',
                  }}>
                    暂无图片
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#333' }}>当前封面</div>
                  <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                    {editImages.length > 0 ? '第一张图片自动作为封面，点击可定位' : '上传图片后自动设置封面'}
                  </div>
                </div>
              </div>

              {/* 图片网格 */}
              {editImages.length > 0 && (
                <Image.PreviewGroup>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                    {editImages.map((img, idx) => (
                      <div
                        key={img.id}
                        ref={idx === 0 ? firstImageRef : undefined}
                        style={{
                          position: 'relative', width: 100,
                          outline: idx === 0 && highlightFirst ? '2px solid #1677ff' : 'none',
                          borderRadius: 4, transition: 'outline 0.3s',
                        }}
                      >
                        <Image
                          src={img.url}
                          width={100}
                          height={75}
                          style={{
                            objectFit: 'cover', borderRadius: 4, display: 'block',
                            border: idx === 0 ? '2px solid #1677ff' : '1px solid #f0f0f0',
                          }}
                        />
                        {idx === 0 && (
                          <div style={{
                            position: 'absolute', top: 2, left: 2, background: '#1677ff',
                            color: '#fff', fontSize: 10, padding: '1px 5px', borderRadius: 3,
                            pointerEvents: 'none',
                          }}>
                            封面
                          </div>
                        )}
                        <div style={{ marginTop: 2, display: 'flex', justifyContent: 'center', gap: 0 }}>
                          {idx > 0 && (
                            <Button
                              size="small" type="link"
                              style={{ fontSize: 11, padding: '0 4px', color: '#1677ff' }}
                              onClick={() => setCoverImage(img)}
                            >
                              封面
                            </Button>
                          )}
                          <Popconfirm
                            title="确认删除此图片？"
                            onConfirm={async () => {
                              if (!editTarget) return
                              await deletePropertyImage(editTarget.id, img.id)
                              setEditImages(prev => prev.filter(i => i.id !== img.id))
                              message.success('图片已删除')
                            }}
                          >
                            <Button size="small" type="link" danger icon={<DeleteOutlined />} style={{ fontSize: 11, padding: '0 4px' }}>
                              删除
                            </Button>
                          </Popconfirm>
                        </div>
                      </div>
                    ))}
                  </div>
                </Image.PreviewGroup>
              )}

              {/* 视频区域 */}
              {editVideoUrl && (
                <div style={{ marginBottom: 10 }}>
                  <video src={editVideoUrl} controls width={200} style={{ borderRadius: 4, display: 'block' }} />
                  <Button
                    size="small" type="link" danger
                    style={{ padding: 0, marginTop: 2 }}
                    onClick={() => setEditVideoUrl('')}
                  >
                    删除视频
                  </Button>
                </div>
              )}

              {/* 上传按钮 */}
              <Space wrap>
                <Upload
                  accept="image/*"
                  multiple
                  showUploadList={false}
                  beforeUpload={async (file) => {
                    if (!editTarget) return false
                    const fd = new FormData()
                    fd.append('image', file)
                    try {
                      const res: any = await uploadPropertyImage(editTarget.id, fd)
                      if (res.data) setEditImages(prev => [...prev, res.data])
                    } catch { /* shown by interceptor */ }
                    return false
                  }}
                >
                  <Button icon={<UploadOutlined />}>上传图片</Button>
                </Upload>
                {!editVideoUrl && (
                  <Upload
                    accept="video/*"
                    showUploadList={false}
                    beforeUpload={async (file) => {
                      if (!editTarget) return false
                      const fd = new FormData()
                      fd.append('video', file)
                      try {
                        const res: any = await uploadPropertyVideo(editTarget.id, fd)
                        if (res.data?.url) {
                          setEditVideoUrl(res.data.url)
                          message.success('视频已上传')
                        }
                      } catch { /* shown by interceptor */ }
                      return false
                    }}
                  >
                    <Button icon={<VideoCameraOutlined />}>上传视频</Button>
                  </Upload>
                )}
              </Space>
            </Spin>
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
                onClick={() => applyAddressParse(editParseInput, editForm, setEditProvince, setEditCity)}
              >
                自动填充
              </Button>
            </Space.Compact>
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="province" label="省份">
                <AutoComplete
                  options={PROVINCE_OPTIONS}
                  filterOption={(input, option) => pinyinMatch(option?.value as string || '', input)}
                  placeholder="输入省份或拼音"
                  onChange={(v) => {
                    setEditProvince(v)
                    editForm.setFieldValue('city', undefined)
                    editForm.setFieldValue('district', undefined)
                    setEditCity('')
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="city" label="城市" rules={[{ required: true }]}>
                <AutoComplete
                  options={cityOptions(editProvince)}
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

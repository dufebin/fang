const { createProperty, updateProperty, getAgentPropertyDetail, deletePropertyImage, updatePropertyStatus } = require('../../api/property')
const { uploadPropertyImage } = require('../../api/agent')
const { fullImageURL } = require('../../utils/format')
const { QQMAP_KEY } = require('../../utils/config')

const DECORATIONS = ['毛坯', '简装', '精装', '豪华装修']
const DIRECTIONS = ['南北', '东西', '朝南', '朝北', '朝东', '朝西', '东南', '西南', '东北', '西北']
const STATUSES = [
  { value: 'available', label: '在售' },
  { value: 'sold', label: '已售' },
  { value: 'rented', label: '已租' },
  { value: 'offline', label: '已下架' },
]

Page({
  data: {
    isEdit: false,
    propertyId: null,
    _originalStatus: 'available',
    form: {
      title: '',
      property_type: '二手房',
      province: '',
      city: '',
      district: '',
      address: '',
      total_price: '',
      monthly_rent: '',
      area: '',
      bedrooms: '',
      living_rooms: '',
      bathrooms: '',
      floor: '',
      total_floors: '',
      decoration: '',
      direction: '',
      description: '',
    },
    status: 'available',
    descLength: 0,
    regionValue: ['', '', ''],
    locating: false,
    images: [],
    _newImagePaths: [],
    propertyTypes: ['新房', '二手房', '租房', '商铺'],
    decorations: DECORATIONS,
    directions: DIRECTIONS,
    statuses: STATUSES,
  },

  async onLoad(options) {
    if (options.id) {
      this.setData({ isEdit: true, propertyId: Number(options.id) })
      wx.setNavigationBarTitle({ title: '编辑房源' })
      await this._loadProperty(Number(options.id))
    }
  },

  async _loadProperty(id) {
    wx.showLoading({ title: '加载中...' })
    try {
      const res = await getAgentPropertyDetail(id)
      const p = res.data || res
      this.setData({
        _originalStatus: p.status || 'available',
        status: p.status || 'available',
        form: {
          title: p.title || '',
          property_type: p.property_type || '二手房',
          province: p.province || '',
          city: p.city || '',
          district: p.district || '',
          address: p.address || '',
          total_price: p.total_price != null ? String(p.total_price) : '',
          monthly_rent: p.monthly_rent != null ? String(p.monthly_rent) : '',
          area: p.area != null ? String(p.area) : '',
          bedrooms: p.bedrooms != null ? String(p.bedrooms) : '',
          living_rooms: p.living_rooms != null ? String(p.living_rooms) : '',
          bathrooms: p.bathrooms != null ? String(p.bathrooms) : '',
          floor: p.floor != null ? String(p.floor) : '',
          total_floors: p.total_floors != null ? String(p.total_floors) : '',
          decoration: p.decoration || '',
          direction: p.direction || '',
          description: p.description || '',
        },
        images: (p.images || []).map(img => ({ id: img.id, url: fullImageURL(img.url) })),
        descLength: (p.description || '').length,
        regionValue: [p.province || '', p.city || '', p.district || ''],
      })
    } catch (_) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
    wx.hideLoading()
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field
    const update = { [`form.${field}`]: e.detail.value }
    if (field === 'description') update.descLength = e.detail.value.length
    this.setData(update)
  },

  onStepper(e) {
    const { field, op } = e.currentTarget.dataset
    const cur = Number(this.data.form[field]) || 0
    const next = op === 'inc' ? cur + 1 : Math.max(0, cur - 1)
    this.setData({ [`form.${field}`]: String(next) })
  },

  onTypeSelect(e) {
    this.setData({ 'form.property_type': e.currentTarget.dataset.val })
  },

  onDecorationSelect(e) {
    this.setData({ 'form.decoration': e.currentTarget.dataset.val })
  },

  onDirectionSelect(e) {
    this.setData({ 'form.direction': e.currentTarget.dataset.val })
  },

  onStatusSelect(e) {
    this.setData({ status: e.currentTarget.dataset.val })
  },

  onRegionChange(e) {
    const [province, city, district] = e.detail.value
    this.setData({
      'form.province': province,
      'form.city': city,
      'form.district': district,
      regionValue: e.detail.value,
    })
  },

  onAutoLocation() {
    if (this.data.locating) return
    this.setData({ locating: true })
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        const { latitude, longitude } = res
        wx.request({
          url: `https://apis.map.qq.com/ws/geocoder/v1/?location=${latitude},${longitude}&key=${QQMAP_KEY}&get_poi=0`,
          success: (r) => {
            const info = r.data && r.data.result && r.data.result.address_component
            if (info) {
              const province = info.province || ''
              const city = info.city || ''
              const district = info.district || ''
              this.setData({
                'form.province': province,
                'form.city': city,
                'form.district': district,
                regionValue: [province, city, district],
                locating: false,
              })
            } else {
              this.setData({ locating: false })
              wx.showToast({ title: '定位解析失败', icon: 'none' })
            }
          },
          fail: () => {
            this.setData({ locating: false })
            wx.showToast({ title: '网络请求失败', icon: 'none' })
          },
        })
      },
      fail: () => {
        this.setData({ locating: false })
        wx.showToast({ title: '定位失败，请手动选择', icon: 'none' })
      },
    })
  },

  onAddImage() {
    const current = this.data.images.length
    if (current >= 9) return
    wx.chooseMedia({
      count: 9 - current,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: res => {
        const newPaths = res.tempFiles.map(f => f.tempFilePath)
        this.setData({
          images: [...this.data.images, ...newPaths],
          _newImagePaths: [...this.data._newImagePaths, ...newPaths],
        })
      },
    })
  },

  async onDelImage(e) {
    const idx = e.currentTarget.dataset.index
    const item = this.data.images[idx]
    if (item && typeof item === 'object' && item.id) {
      try {
        await deletePropertyImage(this.data.propertyId, item.id)
      } catch (_) {
        wx.showToast({ title: '删除失败', icon: 'none' })
        return
      }
    }
    const images = this.data.images.filter((_, i) => i !== idx)
    const newPaths = typeof item === 'string'
      ? this.data._newImagePaths.filter(p => p !== item)
      : this.data._newImagePaths
    this.setData({ images, _newImagePaths: newPaths })
  },

  async onSubmit() {
    const { form, isEdit, propertyId, _newImagePaths, status, _originalStatus } = this.data
    if (!form.title) { wx.showToast({ title: '请填写房源标题', icon: 'none' }); return }
    if (!form.total_price && !form.monthly_rent) { wx.showToast({ title: '请填写价格', icon: 'none' }); return }
    if (!form.city) { wx.showToast({ title: '请填写城市', icon: 'none' }); return }
    if (!form.district) { wx.showToast({ title: '请填写区域', icon: 'none' }); return }
    if (!form.area) { wx.showToast({ title: '请填写面积', icon: 'none' }); return }

    wx.showLoading({ title: isEdit ? '保存中...' : '发布中...' })
    try {
      const payload = {
        ...form,
        total_price: form.total_price ? Number(form.total_price) : undefined,
        monthly_rent: form.monthly_rent ? Number(form.monthly_rent) : undefined,
        bedrooms: Number(form.bedrooms) || 0,
        living_rooms: Number(form.living_rooms) || 0,
        bathrooms: Number(form.bathrooms) || 0,
        area: Number(form.area) || 0,
        floor: form.floor ? Number(form.floor) : undefined,
        total_floors: form.total_floors ? Number(form.total_floors) : undefined,
      }

      let pid = propertyId
      if (isEdit) {
        await updateProperty(pid, payload)
        if (status !== _originalStatus) {
          await updatePropertyStatus(pid, status)
        }
      } else {
        const res = await createProperty(payload)
        pid = (res.data || res).id
      }

      const allImages = this.data.images
      for (const path of _newImagePaths) {
        const sortOrder = allImages.findIndex(img => img === path)
        await uploadPropertyImage(pid, path, sortOrder >= 0 ? sortOrder : 0)
      }

      wx.hideLoading()
      wx.showToast({ title: isEdit ? '保存成功' : '发布成功' })
      setTimeout(() => wx.navigateBack(), 1500)
    } catch (err) {
      wx.hideLoading()
      const msg = (err && (err.message || err.errMsg)) || '操作失败'
      console.error('[property-edit] submit error:', err)
      wx.showToast({ title: msg.length > 14 ? '操作失败' : msg, icon: 'none' })
    }
  },
})

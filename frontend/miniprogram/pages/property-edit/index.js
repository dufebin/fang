const { createProperty, updateProperty } = require('../../api/property')
const { uploadPropertyImage } = require('../../api/agent')
const { fullImageURL } = require('../../utils/format')

Page({
  data: {
    isEdit: false,
    propertyId: null,
    form: {
      title: '',
      property_type: '住宅',
      total_price: '',
      bedrooms: '',
      living_rooms: '',
      bathrooms: '',
      area: '',
      floor: '',
      total_floors: '',
      district: '',
      address: '',
      description: '',
    },
    images: [],
    _newImagePaths: [],
    propertyTypes: ['住宅', '公寓', '别墅', '商铺', '办公室', '租房'],
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ isEdit: true, propertyId: options.id })
      wx.setNavigationBarTitle({ title: '编辑房源' })
    }
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`form.${field}`]: e.detail.value })
  },

  onTypeSelect(e) {
    this.setData({ 'form.property_type': e.currentTarget.dataset.val })
  },

  onAddImage() {
    wx.chooseMedia({
      count: 9 - this.data.images.length,
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

  onDelImage(e) {
    const idx = e.currentTarget.dataset.index
    const images = this.data.images.filter((_, i) => i !== idx)
    this.setData({ images })
  },

  async onSubmit() {
    const { form, isEdit, propertyId, _newImagePaths } = this.data
    if (!form.title) { wx.showToast({ title: '请填写房源标题', icon: 'none' }); return }
    if (!form.total_price) { wx.showToast({ title: '请填写价格', icon: 'none' }); return }

    wx.showLoading({ title: isEdit ? '保存中...' : '发布中...' })
    try {
      const payload = {
        ...form,
        total_price: Number(form.total_price) || 0,
        bedrooms: Number(form.bedrooms) || 0,
        living_rooms: Number(form.living_rooms) || 0,
        bathrooms: Number(form.bathrooms) || 0,
        area: Number(form.area) || 0,
        floor: Number(form.floor) || 0,
        total_floors: Number(form.total_floors) || 0,
      }

      let pid = propertyId
      if (isEdit) {
        await updateProperty(pid, payload)
      } else {
        const res = await createProperty(payload)
        pid = res.id
      }

      for (let i = 0; i < _newImagePaths.length; i++) {
        await uploadPropertyImage(pid, _newImagePaths[i], i)
      }

      wx.hideLoading()
      wx.showToast({ title: isEdit ? '保存成功' : '发布成功' })
      setTimeout(() => wx.navigateBack(), 1500)
    } catch (_) {
      wx.hideLoading()
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },
})

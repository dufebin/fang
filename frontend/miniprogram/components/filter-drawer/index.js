Component({
  properties: {
    show: { type: Boolean, value: false },
  },

  data: {
    filter: {
      property_type: '',
      district: '',
      min_price: '',
      max_price: '',
      min_area: '',
      max_area: '',
      bedrooms: '',
    },
    propertyTypes: ['不限', '住宅', '公寓', '别墅', '商铺', '办公室', '租房'],
    bedroomOptions: ['不限', '1室', '2室', '3室', '4室', '5室+'],
  },

  methods: {
    onMaskTap() {
      this.triggerEvent('close')
    },

    onTypeSelect(e) {
      const val = e.currentTarget.dataset.val
      this.setData({ 'filter.property_type': val === '不限' ? '' : val })
    },

    onBedroomSelect(e) {
      const val = e.currentTarget.dataset.val
      this.setData({ 'filter.bedrooms': val === '不限' ? '' : val.replace('室', '') })
    },

    onInputChange(e) {
      const field = e.currentTarget.dataset.field
      this.setData({ [`filter.${field}`]: e.detail.value })
    },

    onReset() {
      this.setData({
        filter: {
          property_type: '',
          district: '',
          min_price: '',
          max_price: '',
          min_area: '',
          max_area: '',
          bedrooms: '',
        },
      })
    },

    onConfirm() {
      const filter = { ...this.data.filter }
      Object.keys(filter).forEach(k => { if (filter[k] === '') delete filter[k] })
      this.triggerEvent('confirm', filter)
    },
  },
})

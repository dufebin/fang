Component({
  properties: {
    show: { type: Boolean, value: false }
  },

  data: {
    filter: {
      type: '',
      district: '',
      min_price: '',
      max_price: '',
      min_area: '',
      max_area: '',
      bedrooms: ''
    },
    propertyTypes: [
      { value: '', label: '不限' },
      { value: 'second_hand', label: '二手房' },
      { value: 'new_home', label: '新房' },
      { value: 'rent', label: '租房' },
      { value: 'decoration', label: '装修' },
      { value: 'commercial', label: '商铺办公' },
    ],
    bedroomOptions: ['不限', '1室', '2室', '3室', '4室', '5室+']
  },

  methods: {
    onMaskTap: function() {
      this.triggerEvent('close')
    },

    onTypeSelect: function(e) {
      this.setData({ 'filter.type': e.currentTarget.dataset.val })
    },

    onBedroomSelect: function(e) {
      var val = e.currentTarget.dataset.val
      var newVal = val === '不限' ? '' : val.replace('室', '')
      this.setData({ 'filter.bedrooms': newVal })
    },

    onInputChange: function(e) {
      var field = e.currentTarget.dataset.field
      var obj = {}
      obj[field] = e.detail.value
      this.setData({ filter: Object.assign({}, this.data.filter, obj) })
    },

    onReset: function() {
      this.setData({
        filter: {
          type: '',
          district: '',
          min_price: '',
          max_price: '',
          min_area: '',
          max_area: '',
          bedrooms: ''
        }
      })
    },

    onConfirm: function() {
      var f = this.data.filter
      var result = {}
      Object.keys(f).forEach(function(k) {
        if (f[k] !== '' && f[k] !== undefined && f[k] !== null) {
          result[k] = f[k]
        }
      })
      this.triggerEvent('confirm', result)
    }
  }
})

Component({
  properties: {
    icon: { type: String, value: '/assets/icons/empty.png' },
    text: { type: String, value: '暂无数据' },
    btnText: { type: String, value: '' },
  },

  methods: {
    onAction() {
      this.triggerEvent('action')
    },
  },
})

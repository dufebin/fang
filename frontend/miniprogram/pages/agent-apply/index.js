const { submitAgentApply, getMyApply } = require('../../api/user')

const STATUS_CONFIG = {
  pending:  { icon: '⏳', text: '申请审核中', hint: '请耐心等待，审核通过后将收到通知' },
  approved: { icon: '✅', text: '申请已通过', hint: '您已成为认证经纪人，请前往工作台' },
  rejected: { icon: '❌', text: '申请未通过', hint: '您可以重新提交申请' },
}

Page({
  data: {
    applied: false,
    statusIcon: '',
    statusText: '',
    statusHint: '',
    form: { name: '', phone: '', years: '', bio: '' },
    loading: false,
  },

  async onLoad() {
    try {
      const apply = await getMyApply()
      if (apply && apply.status) {
        const cfg = STATUS_CONFIG[apply.status] || {}
        this.setData({
          applied: apply.status !== 'rejected',
          statusIcon: cfg.icon,
          statusText: cfg.text,
          statusHint: cfg.hint,
        })
      }
    } catch (_) {}
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`form.${field}`]: e.detail.value })
  },

  async onSubmit() {
    const { name, phone, bio } = this.data.form
    if (!name || !phone) {
      wx.showToast({ title: '请填写姓名和电话', icon: 'none' })
      return
    }
    this.setData({ loading: true })
    try {
      await submitAgentApply({ ...this.data.form, years: Number(this.data.form.years) || 0 })
      const cfg = STATUS_CONFIG.pending
      this.setData({ applied: true, statusIcon: cfg.icon, statusText: cfg.text, statusHint: cfg.hint })
    } catch (_) {
      wx.showToast({ title: '提交失败，请重试', icon: 'none' })
    }
    this.setData({ loading: false })
  },
})

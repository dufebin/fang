const { getProfile, updateProfile, uploadAvatar } = require('../../api/agent')
const { fullImageURL } = require('../../utils/format')

Page({
  data: {
    form: { name: '', title: '', phone: '', bio: '' },
    avatarUrl: '/assets/icons/default-avatar.png',
    _avatarFilePath: '',
  },

  async onLoad() {
    try {
      const p = await getProfile()
      this.setData({
        form: {
          name: p.name || '',
          title: p.title || '',
          phone: p.phone || '',
          bio: p.bio || '',
        },
        avatarUrl: p.avatar ? fullImageURL(p.avatar) : '/assets/icons/default-avatar.png',
      })
    } catch (_) {}
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`form.${field}`]: e.detail.value })
  },

  onChangeAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: async res => {
        const filePath = res.tempFiles[0].tempFilePath
        this.setData({ avatarUrl: filePath, _avatarFilePath: filePath })
      },
    })
  },

  async onSave() {
    const { form, _avatarFilePath } = this.data
    if (!form.name) { wx.showToast({ title: '请填写姓名', icon: 'none' }); return }
    try {
      if (_avatarFilePath) {
        await uploadAvatar(_avatarFilePath)
      }
      await updateProfile(form)
      wx.showToast({ title: '保存成功' })
      wx.navigateBack()
    } catch (_) {
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  },
})

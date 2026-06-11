const { getPropertyDetail } = require('../../api/property')
const { fullImageURL, formatPrice, formatArea, formatLayout, formatFloor } = require('../../utils/format')
const { BASE_URL } = require('../../utils/config')

const W = 750
const H = 1280
const COVER_H = 420

Page({
  data: { generating: true, posterPath: '', error: '' },

  onLoad(options) {
    this._id = options.id
    this._agentCode = options.a || wx.getStorageSync('agentCode') || ''
  },

  // onReady 确保 canvas DOM 已渲染
  async onReady() {
    await this._generate()
  },

  onRetry() {
    this.setData({ generating: true, error: '' })
    this._generate()
  },

  async _generate() {
    try {
      const property = await getPropertyDetail(this._id, this._agentCode)
      const agent = property.agent || {}

      const coverUrl = (property.images && property.images.length > 0)
        ? fullImageURL(property.images[0].url)
        : (property.cover_image ? fullImageURL(property.cover_image) : null)

      const qrUrl = `${BASE_URL}/h5/property/${this._id}/wxacode${this._agentCode ? '?a=' + this._agentCode : ''}`

      const [coverPath, qrPath, avatarPath] = await Promise.all([
        coverUrl ? downloadToTemp(coverUrl).catch(() => null) : Promise.resolve(null),
        downloadToTemp(qrUrl).catch(() => null),
        agent.avatar_url ? downloadToTemp(fullImageURL(agent.avatar_url)).catch(() => null) : Promise.resolve(null),
      ])

      const filePath = await drawPoster({ property, agent, coverPath, qrPath, avatarPath })
      this.setData({ generating: false, posterPath: filePath })
    } catch (e) {
      console.error('[poster]', e)
      this.setData({ generating: false, error: e.message || '海报生成失败，请重试' })
    }
  },

  onSave() {
    wx.saveImageToPhotosAlbum({
      filePath: this.data.posterPath,
      success: () => wx.showToast({ title: '已保存到相册' }),
      fail: (e) => {
        if ((e.errMsg || '').includes('auth')) {
          wx.showModal({
            title: '需要相册权限',
            content: '请在设置中允许访问相册',
            confirmText: '去设置',
            success: r => { if (r.confirm) wx.openSetting() },
          })
        }
      },
    })
  },

  onShareLink() {
    const url = `/pages/property-detail/index?id=${this._id}${this._agentCode ? '&a=' + this._agentCode : ''}`
    wx.setClipboardData({ data: url, success: () => wx.showToast({ title: '链接已复制' }) })
  },

  onShareAppMessage() {
    return {
      title: '为你推荐这套好房',
      path: `/pages/property-detail/index?id=${this._id}${this._agentCode ? '&a=' + this._agentCode : ''}`,
      imageUrl: this.data.posterPath || '',
    }
  },
})

// ── Canvas drawing ──────────────────────────────────────────────────────────

async function drawPoster({ property, agent, coverPath, qrPath, avatarPath }) {
  const canvas = await getCanvas('#poster-canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  // Background
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)

  // Cover image
  if (coverPath) {
    const img = await loadImage(canvas, coverPath)
    ctx.drawImage(img, 0, 0, W, COVER_H)
  } else {
    ctx.fillStyle = '#DBEAFE'
    ctx.fillRect(0, 0, W, COVER_H)
  }

  // Gradient overlay on cover
  const grad = ctx.createLinearGradient(0, COVER_H - 140, 0, COVER_H)
  grad.addColorStop(0, 'rgba(0,0,0,0)')
  grad.addColorStop(1, 'rgba(0,0,0,0.65)')
  ctx.fillStyle = grad
  ctx.fillRect(0, COVER_H - 140, W, 140)

  // Property type badge
  const typeLabel = typeMap(property.property_type)
  ctx.fillStyle = '#0284C7'
  ctx.beginPath()
  roundRect(ctx, 32, COVER_H - 116, typeLabel.length * 16 + 40, 48, 10)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 26px sans-serif'
  ctx.fillText(typeLabel, 52, COVER_H - 83)

  // Price
  const priceText = formatPrice(property.total_price, property.property_type === 'rent' ? 'rent' : 'sale')
  ctx.fillStyle = '#F97316'
  ctx.font = 'bold 68px sans-serif'
  ctx.fillText(priceText, 32, COVER_H + 88)

  // Title
  ctx.fillStyle = '#111827'
  ctx.font = 'bold 38px sans-serif'
  ctx.fillText(clip(property.title || '', 20), 32, COVER_H + 152)

  // Meta row
  const meta = [
    formatLayout(property.bedrooms, property.living_rooms, property.bathrooms),
    formatArea(property.area),
    formatFloor(property.floor, property.total_floors),
    property.district,
  ].filter(Boolean).join('  ·  ')
  ctx.fillStyle = '#6B7280'
  ctx.font = '27px sans-serif'
  ctx.fillText(meta, 32, COVER_H + 208)

  // Divider
  ctx.strokeStyle = '#E5E7EB'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(32, COVER_H + 248); ctx.lineTo(W - 32, COVER_H + 248); ctx.stroke()

  // Agent section
  const AY = COVER_H + 280
  if (avatarPath) {
    try {
      const img = await loadImage(canvas, avatarPath)
      ctx.save()
      ctx.beginPath()
      ctx.arc(32 + 44, AY + 44, 44, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(img, 32, AY, 88, 88)
      ctx.restore()
    } catch (_) { avatarCircle(ctx, 32, AY, 88) }
  } else {
    avatarCircle(ctx, 32, AY, 88)
  }
  ctx.fillStyle = '#111827'
  ctx.font = 'bold 30px sans-serif'
  ctx.fillText(agent.name || '经纪人', 144, AY + 30)
  ctx.fillStyle = '#9CA3AF'
  ctx.font = '25px sans-serif'
  ctx.fillText(agent.phone || agent.agent_code || '专业经纪人', 144, AY + 68)

  // QR section
  const QY = AY + 116
  ctx.fillStyle = '#F9FAFB'
  ctx.beginPath()
  roundRect(ctx, 32, QY, W - 64, 196, 16)
  ctx.fill()

  if (qrPath) {
    const qrImg = await loadImage(canvas, qrPath)
    ctx.drawImage(qrImg, 52, QY + 18, 160, 160)
  }
  ctx.fillStyle = '#111827'
  ctx.font = 'bold 30px sans-serif'
  ctx.fillText('扫码查看房源详情', 240, QY + 64)
  ctx.fillStyle = '#6B7280'
  ctx.font = '25px sans-serif'
  ctx.fillText('微信扫描小程序码', 240, QY + 106)
  ctx.fillText('查看完整房源信息', 240, QY + 144)

  // Footer
  ctx.fillStyle = '#0284C7'
  ctx.fillRect(0, H - 72, W, 72)
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 26px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('专业房产经纪服务平台', W / 2, H - 38)
  ctx.textAlign = 'left'

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('导出画布超时，请重试')), 15000)
    wx.canvasToTempFilePath({
      canvas,
      fileType: 'jpg',
      quality: 0.92,
      success: r => { clearTimeout(timer); resolve(r.tempFilePath) },
      fail: e => { clearTimeout(timer); reject(e) },
    })
  })
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getCanvas(selector) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('canvas 未就绪，请重试')), 5000)
    wx.createSelectorQuery()
      .select(selector)
      .fields({ node: true, size: true })
      .exec(res => {
        clearTimeout(timer)
        if (res && res[0] && res[0].node) resolve(res[0].node)
        else reject(new Error('canvas 节点未找到'))
      })
  })
}

function loadImage(canvas, src) {
  return new Promise((resolve, reject) => {
    const img = canvas.createImage()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function downloadToTemp(url, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('download timeout')), timeout)
    wx.downloadFile({
      url,
      success: r => { clearTimeout(timer); r.statusCode === 200 ? resolve(r.tempFilePath) : reject(new Error('status ' + r.statusCode)) },
      fail: e => { clearTimeout(timer); reject(e) },
    })
  })
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

function avatarCircle(ctx, x, y, size) {
  ctx.fillStyle = '#DBEAFE'
  ctx.beginPath()
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2)
  ctx.fill()
}

function clip(str, max) {
  return str.length > max ? str.slice(0, max) + '…' : str
}

function typeMap(t) {
  const m = { second_hand: '二手房', new_home: '新房', rent: '租房', decoration: '装修', commercial: '商铺办公' }
  return m[t] || '房源'
}

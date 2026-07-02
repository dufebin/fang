// 智慧停车管理平台 - 纯展示假界面，无后端功能
// 标题点击 6 次弹出密码框，进入隐藏聊天界面（密码逻辑与「我的」页一致）
// 总车位固定 500；收入/入场/出场自 6:00 起按小时累加（6 点前为 0）；
// 车牌/区域占用/车位网格/告警每小时按「日期+小时」种子重新生成（一小时内稳定）

// --- 按日期种子的伪随机数（同一天得到相同序列） ---
function hashSeed(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const PLATE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const PLATE_PREFIX = ['A', 'B', 'C', 'Q']
const TYPE_LIST = [
  { name: '月卡', key: 'monthly' },
  { name: '临时', key: 'temp' },
  { name: 'VIP', key: 'vip' },
]
const ALERT_POOL = [
  { level: 'warn', tpl: 'C区 地下一层 通讯离线 {n} 分钟' },
  { level: 'warn', tpl: 'A区 入口道闸 异常抬起' },
  { level: 'warn', tpl: 'C区 出口 扫码桩离线' },
  { level: 'info', tpl: 'B区 {n} 号车位 地磁电量低' },
  { level: 'info', tpl: 'A区 7 号车位 长时占用 {n} 小时' },
  { level: 'info', tpl: 'B区 监控摄像头 信号丢失' },
]

function randPlate(rand) {
  const p = PLATE_PREFIX[Math.floor(rand() * PLATE_PREFIX.length)]
  let s = ''
  for (let i = 0; i < 5; i++) s += PLATE_CHARS[Math.floor(rand() * PLATE_CHARS.length)]
  return '京' + p + '·' + s
}
function fmtHM(totalMin) {
  const m = ((totalMin % 1440) + 1440) % 1440
  const h = Math.floor(m / 60), mm = m % 60
  return (h < 10 ? '0' + h : '' + h) + ':' + (mm < 10 ? '0' + mm : '' + mm)
}

Page({
  data: {
    now: '',
    today: '',
    stats: { total: 500, free: 0, occupied: 0, todayIncome: 0, todayFlow: 0, members: 0 },
    zones: [],
    spots: [],
    records: [],
    alerts: [],
    showPasswordModal: false,
    passwordInput: '',
    passwordError: false,
    activeTab: 'home',
  },

  _tapCount: 0,
  _lastTapTime: 0,
  _timer: null,
  _lastHour: -1,

  onLoad() {
    this._tick()
    this._buildHourlyData()
    this._timer = setInterval(() => this._tick(), 1000)
  },

  onUnload() {
    if (this._timer) clearInterval(this._timer)
  },

  _tick() {
    const d = new Date()
    const pad = (n) => (n < 10 ? '0' + n : '' + n)
    const now = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    this.setData({ now, today })
    // 跨小时则刷新数据
    if (d.getHours() !== this._lastHour) {
      this._lastHour = d.getHours()
      this._buildHourlyData()
    }
  },

  // 按「日期+小时」种子生成快照数据；收入/入场/出场自 6:00 起按小时累加
  _buildHourlyData() {
    const d = new Date()
    const pad = (n) => (n < 10 ? '0' + n : '' + n)
    const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    const hour = d.getHours()
    this._lastHour = hour
    const rand = mulberry32(hashSeed(`${dateStr}-${pad(hour)}`))

    // 累计收入/入场/出场：6 点前为 0；6:00 起每小时加一份种子增量（整小时内稳定）
    let todayIncome = 0, enter = 0, exit = 0
    if (hour >= 6) {
      for (let h = 6; h <= hour; h++) {
        const rh = mulberry32(hashSeed(`${dateStr}-${pad(h)}`))
        todayIncome += 120 + Math.floor(rh() * 380) // 120-499 / 小时
        enter += 22 + Math.floor(rh() * 58)         // 22-79 / 小时
        exit += 20 + Math.floor(rh() * 54)          // 20-73 / 小时
      }
    }
    const todayFlow = enter + exit

    // 区域占用（每小时快照），各区总车位固定
    const zoneDefs = [
      { name: 'A区 地上一层', total: 180 },
      { name: 'B区 地上二层', total: 160 },
      { name: 'C区 地下一层', total: 160 },
    ]
    let occupied = 0
    const zones = zoneDefs.map((z) => {
      const used = Math.floor(z.total * (0.55 + rand() * 0.35))
      occupied += used
      return { name: z.name, total: z.total, used, rate: Math.round((used / z.total) * 100) }
    })
    const total = 500
    const free = total - occupied

    // 月卡会员、较昨日% 按日稳定（一天内不变）
    const dayRand = mulberry32(hashSeed(dateStr))
    const members = 280 + Math.floor(dayRand() * 80)
    const flowDelta = (dayRand() * 20 - 5).toFixed(1) // -5.0 ~ +15.0

    // 车位网格 A1~A30（每小时快照）
    const spots = []
    for (let i = 0; i < 30; i++) {
      const r = rand()
      const state = r < 0.68 ? 1 : r < 0.93 ? 0 : 2 // 已停/空余/维护
      spots.push({ code: 'A' + (i + 1), state })
    }

    // 最近出入记录：车牌/类型/费用按小时种子（每小时变一次），时间相对当前倒推
    const nowMin = hour * 60 + d.getMinutes()
    const records = []
    let cursor = nowMin - 2
    for (let i = 0; i < 7; i++) {
      const t = TYPE_LIST[Math.floor(rand() * TYPE_LIST.length)]
      const isOut = rand() < 0.5
      const rec = {
        plate: randPlate(rand),
        type: t.name,
        typeKey: t.key,
        action: isOut ? '出场' : '入场',
        time: fmtHM(cursor),
        status: 'ok',
      }
      if (isOut) {
        if (rand() < 0.12) {
          rec.fee = '未支付'
          rec.status = 'warn'
        } else {
          rec.fee = '¥' + (5 + Math.floor(rand() * 45))
        }
      }
      records.push(rec)
      cursor -= 3 + Math.floor(rand() * 4)
    }

    // 告警 1~3 条（每小时快照）
    const alertCount = 1 + Math.floor(rand() * 3)
    const alerts = []
    for (let i = 0; i < alertCount; i++) {
      const a = ALERT_POOL[Math.floor(rand() * ALERT_POOL.length)]
      const n = 1 + Math.floor(rand() * 30)
      alerts.push({
        level: a.level,
        text: a.tpl.replace('{n}', n),
        time: fmtHM(nowMin - 5 - i * 12 - Math.floor(rand() * 6)),
      })
    }

    const stats = { total, free, occupied, todayIncome, todayFlow, enter, exit, members, flowDelta }
    this.setData({ stats, zones, spots, records, alerts })
  },

  onTitleTap() {
    const now = Date.now()
    if (now - this._lastTapTime > 5000) {
      this._tapCount = 0
    }
    this._tapCount++
    this._lastTapTime = now
    if (this._tapCount >= 6) {
      this._tapCount = 0
      this.setData({ showPasswordModal: true, passwordInput: '', passwordError: false })
    }
  },

  onPasswordInput(e) {
    this.setData({ passwordInput: e.detail.value, passwordError: false })
  },

  onPasswordConfirm() {
    const pwd = this.data.passwordInput
    if (pwd === '147789' || pwd === '669221') {
      this.setData({ showPasswordModal: false, passwordInput: '' })
      wx.navigateTo({ url: '/pages/chat-list/index' })
    } else if (pwd === '888888') {
      this.setData({ showPasswordModal: false, passwordInput: '' })
      wx.navigateTo({ url: '/pages/chat-list/index?clean=1' })
    } else {
      this.setData({ passwordError: true, passwordInput: '' })
    }
  },

  onPasswordCancel() {
    this.setData({ showPasswordModal: false, passwordInput: '', passwordError: false })
  },

  onDialogTap() {},

  onMaskTap() {
    this.setData({ showPasswordModal: false, passwordInput: '', passwordError: false })
  },

  onActionTap() {},

  onGoTop() {
    this.setData({ activeTab: 'home' })
    wx.pageScrollTo({ scrollTop: 0, duration: 300 })
  },

  onGoRecords() {
    this.setData({ activeTab: 'records' })
    wx.pageScrollTo({ selector: '#sec-records', duration: 300 })
  },

  onGoAlerts() {
    this.setData({ activeTab: 'alerts' })
    wx.pageScrollTo({ selector: '#sec-alerts', duration: 300 })
  },
})

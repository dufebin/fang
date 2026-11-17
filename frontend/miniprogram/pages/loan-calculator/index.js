const { calcEqualInstallment, calcEqualPrincipal } = require('../../utils/loan')

function wan(v) {
  return v >= 10000 ? (v / 10000).toFixed(2) + '万' : Math.round(v) + '元'
}

// 大数字拆分：数值部分 + 单位（结果卡主数字用）
function splitMoney(v) {
  return v >= 10000
    ? { num: (v / 10000).toFixed(2), unit: '万' }
    : { num: String(Math.round(v)), unit: '元' }
}

Page({
  data: {
    totalPrice: '',
    downRatio: 0.3,
    years: 30,
    rate: '3.95',
    repayType: 'equal_installment',
    loanAmount: 0,
    result: null,
    loanKinds: [
      { value: 'commercial', label: '商业贷款', rate: '3.95' },
      { value: 'fund', label: '公积金', rate: '2.85' },
    ],
    loanKind: 'commercial',
    downRatios: [0.2, 0.3, 0.4, 0.5],
    yearOptions: [10, 15, 20, 25, 30, 35, 40],
    // 底部选择器弹层
    sheet: { visible: false, field: '', title: '', options: [], index: 0 },
  },

  onLoad(options) {
    if (options.price) {
      const totalPrice = Number(options.price)
      const loanAmount = +(totalPrice * (1 - this.data.downRatio)).toFixed(2)
      this.setData({ totalPrice: String(totalPrice), loanAmount })
    }
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [field]: e.detail.value })
    this._updateLoan()
  },

  // ---------- 底部选择器弹层 ----------
  onRatioRowTap() {
    this._openSheet('ratio')
  },

  onYearsRowTap() {
    this._openSheet('years')
  },

  _openSheet(field) {
    const options = field === 'ratio'
      ? this.data.downRatios.map(r => ({ value: r, label: Math.round(r * 100) + '%' }))
      : this.data.yearOptions.map(y => ({ value: y, label: y + '年' }))
    const current = field === 'ratio' ? this.data.downRatio : this.data.years
    const index = Math.max(0, options.findIndex(o => o.value === current))
    this.setData({
      sheet: {
        visible: true,
        field,
        title: field === 'ratio' ? '首付比例' : '贷款年限',
        options,
        index,
      },
    })
  },

  onSheetChange(e) {
    this.setData({ 'sheet.index': e.detail.value[0] })
  },

  onSheetCancel() {
    this.setData({ 'sheet.visible': false })
  },

  onSheetConfirm() {
    const { field, options, index } = this.data.sheet
    const picked = options[index]
    if (picked) {
      if (field === 'ratio') {
        this.setData({ downRatio: picked.value })
        this._updateLoan()
      } else {
        this.setData({ years: picked.value })
      }
    }
    this.setData({ 'sheet.visible': false })
  },

  noop() {},

  // 明细按年折叠展开
  onToggleYear(e) {
    const period = e.currentTarget.dataset.period
    const row = this.data.result.schedule[period - 1]
    if (!row) return
    this.setData({ [`result.schedule[${period - 1}].expanded`]: !row.expanded })
  },

  onTypeTap(e) {
    this.setData({ repayType: e.currentTarget.dataset.val })
    // 切换还款方式后立即重算，结果卡与明细同步更新
    if (this.data.result) this._recalc()
  },

  onKindTap(e) {
    const kind = e.currentTarget.dataset.val
    const preset = this.data.loanKinds.find(k => k.value === kind)
    if (!preset) return
    // 切换贷款种类时带入该种类的常见利率，仍可手动修改
    this.setData({ loanKind: kind, rate: preset.rate })
  },

  _updateLoan() {
    const totalPrice = Number(this.data.totalPrice)
    if (!totalPrice) { this.setData({ loanAmount: 0 }); return }
    const loanAmount = +(totalPrice * (1 - this.data.downRatio)).toFixed(2)
    this.setData({ loanAmount })
  },

  onCalc() {
    if (!this.data.loanAmount || this.data.loanAmount <= 0) {
      wx.showToast({ title: '请输入房屋总价', icon: 'none' })
      return
    }
    this._recalc()
  },

  _recalc() {
    const { loanAmount, years, rate, repayType } = this.data
    const rateVal = Number(rate) || (this.data.loanKind === 'fund' ? 2.85 : 3.95)
    const loanYuan = loanAmount * 10000
    const raw = repayType === 'equal_installment'
      ? calcEqualInstallment(loanYuan, years, rateVal)
      : calcEqualPrincipal(loanYuan, years, rateVal)

    // 按年分组：每年一行，展开后显示该年逐月明细
    const schedule = []
    raw.monthlySchedule.forEach(m => {
      const y = Math.floor((m.month - 1) / 12)
      if (!schedule[y]) {
        schedule[y] = { period: y + 1, monthly: m.monthly, remaining: m.remaining, expanded: false, months: [] }
      }
      schedule[y].months.push({
        idx: m.month,
        monthlyText: wan(m.monthly),
        principalText: wan(m.principal),
        interestText: wan(m.interest),
        remainingText: wan(m.remaining),
      })
    })
    schedule.forEach(row => {
      row.monthlyText = wan(row.monthly)
      row.remainingText = wan(row.remaining)
    })

    // 本息占比（本金 / 还款总额）
    const principalPct = raw.totalPayment > 0
      ? Math.round((loanYuan / raw.totalPayment) * 100)
      : 100
    // 两种还款方式对比（贝壳式并排展示）
    const ei = calcEqualInstallment(loanYuan, years, rateVal)
    const ep = calcEqualPrincipal(loanYuan, years, rateVal)
    const big = splitMoney(raw.monthly)
    const lastRow = raw.monthlySchedule[raw.monthlySchedule.length - 1]
    this.setData({
      result: {
        monthlyNum: big.num,
        monthlyUnit: big.unit,
        lastMonthlyText: repayType === 'equal_principal' && lastRow ? wan(lastRow.monthly) : '',
        loanText: wan(loanYuan),
        totalText: wan(raw.totalPayment),
        interestText: wan(raw.totalInterest),
        monthsText: `${years * 12}期 · ${years}年`,
        principalPct,
        interestPct: 100 - principalPct,
        compare: {
          ei: { monthlyText: wan(ei.monthly), interestText: wan(ei.totalInterest) },
          ep: {
            firstText: wan(ep.monthly),
            lastText: wan(ep.monthlySchedule.length ? ep.monthlySchedule[ep.monthlySchedule.length - 1].monthly : ep.monthly),
            interestText: wan(ep.totalInterest),
          },
        },
        schedule,
      },
    })
  },
})

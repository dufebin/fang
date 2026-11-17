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

// 组合贷：商贷 + 公积金两笔贷款逐月合并
function mergeCalc(commYuan, fundYuan, years, commRate, fundRate, calc) {
  const a = calc(commYuan, years, commRate)
  const b = calc(fundYuan, years, fundRate)
  return {
    monthly: a.monthly + b.monthly,
    totalPayment: a.totalPayment + b.totalPayment,
    totalInterest: a.totalInterest + b.totalInterest,
    monthlySchedule: a.monthlySchedule.map((row, i) => ({
      month: row.month,
      monthly: row.monthly + b.monthlySchedule[i].monthly,
      principal: row.principal + b.monthlySchedule[i].principal,
      interest: row.interest + b.monthlySchedule[i].interest,
      remaining: row.remaining + b.monthlySchedule[i].remaining,
    })),
  }
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
      { value: 'combo', label: '组合贷', rate: '3.95', rateFund: '2.85' },
    ],
    loanKind: 'commercial',
    fundAmount: '',
    rateFund: '2.85',
    commercialAmount: 0,
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
    const patch = { loanKind: kind, rate: preset.rate }
    if (kind === 'combo') {
      patch.rateFund = preset.rateFund
      // 首次进入组合贷默认商贷/公积金各半，仍可修改
      const loan = Number(this.data.loanAmount) || 0
      if (!Number(this.data.fundAmount) && loan > 0) {
        patch.fundAmount = (loan / 2).toFixed(2)
        patch.commercialAmount = +(loan / 2).toFixed(2)
      }
    }
    this.setData(patch)
  },

  _updateLoan() {
    const totalPrice = Number(this.data.totalPrice)
    const loanAmount = totalPrice ? +(totalPrice * (1 - this.data.downRatio)).toFixed(2) : 0
    const patch = { loanAmount }
    // 组合贷：商贷金额 = 贷款总额 - 公积金金额
    if (this.data.loanKind === 'combo') {
      patch.commercialAmount = +Math.max(0, loanAmount - (Number(this.data.fundAmount) || 0)).toFixed(2)
    }
    this.setData(patch)
  },

  onCalc() {
    if (!this.data.loanAmount || this.data.loanAmount <= 0) {
      wx.showToast({ title: '请输入房屋总价', icon: 'none' })
      return
    }
    if (this.data.loanKind === 'combo') {
      const fund = Number(this.data.fundAmount) || 0
      if (fund < 0 || fund > this.data.loanAmount) {
        wx.showToast({ title: '公积金金额需在 0 至贷款总额之间', icon: 'none' })
        return
      }
    }
    this._recalc()
  },

  _recalc() {
    const { loanAmount, years, rate, rateFund, repayType, loanKind } = this.data
    const loanYuan = loanAmount * 10000
    let raw, ei, ep
    if (loanKind === 'combo') {
      // 组合贷：商贷与公积金分摊贷款总额，各自利率，逐月合并
      const fundYuan = Math.min(Math.max((Number(this.data.fundAmount) || 0) * 10000, 0), loanYuan)
      const commYuan = loanYuan - fundYuan
      const commRate = Number(rate) || 3.95
      const fRate = Number(rateFund) || 2.85
      raw = mergeCalc(commYuan, fundYuan, years, commRate, fRate, repayType === 'equal_installment' ? calcEqualInstallment : calcEqualPrincipal)
      ei = mergeCalc(commYuan, fundYuan, years, commRate, fRate, calcEqualInstallment)
      ep = mergeCalc(commYuan, fundYuan, years, commRate, fRate, calcEqualPrincipal)
    } else {
      const rateVal = Number(rate) || (loanKind === 'fund' ? 2.85 : 3.95)
      raw = repayType === 'equal_installment'
        ? calcEqualInstallment(loanYuan, years, rateVal)
        : calcEqualPrincipal(loanYuan, years, rateVal)
      ei = calcEqualInstallment(loanYuan, years, rateVal)
      ep = calcEqualPrincipal(loanYuan, years, rateVal)
    }

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

const { calcEqualInstallment, calcEqualPrincipal } = require('../../utils/loan')

const COMMERCIAL_RATE = '3.5'
const FUND_RATE = '2.6'
const YEAR_OPTIONS = Array.from({ length: 40 }, (_, i) => i + 1)
const RATE_MODE_OPTIONS = [
  { value: 'benchmark', label: '按旧版基准利率', rate: '4.9' },
  { value: 'lpr', label: '按LPR', rate: COMMERCIAL_RATE },
]
const FUND_RATE_OPTIONS = [
  { value: '2.6', label: '最新基准利率(2.6%)' },
  { value: '2.85', label: '旧版基准利率(2.85%)' },
]

function wan(v) {
  return v >= 10000 ? (v / 10000).toFixed(2) + '万' : Math.round(v) + '元'
}

function splitMoney(v) {
  return v >= 10000
    ? { num: (v / 10000).toFixed(2), unit: '万' }
    : { num: String(Math.round(v)), unit: '元' }
}

function roundWan(v) {
  return Math.round((v + Number.EPSILON) * 100) / 100
}

function displayWan(v) {
  return String(roundWan(v))
}

function emptyCalc() {
  return { monthly: 0, totalPayment: 0, totalInterest: 0, monthlySchedule: [] }
}

// 组合贷按自然月合并；一笔贷款先还完时，后续月份只保留另一笔月供。
function mergeCalc(commYuan, fundYuan, commYears, fundYears, commRate, fundRate, calc) {
  const a = commYuan > 0 ? calc(commYuan, commYears, commRate) : emptyCalc()
  const b = fundYuan > 0 ? calc(fundYuan, fundYears, fundRate) : emptyCalc()
  const count = Math.max(a.monthlySchedule.length, b.monthlySchedule.length)
  const monthlySchedule = []
  for (let i = 0; i < count; i++) {
    const ar = a.monthlySchedule[i]
    const br = b.monthlySchedule[i]
    monthlySchedule.push({
      month: i + 1,
      monthly: (ar ? ar.monthly : 0) + (br ? br.monthly : 0),
      principal: (ar ? ar.principal : 0) + (br ? br.principal : 0),
      interest: (ar ? ar.interest : 0) + (br ? br.interest : 0),
      remaining: (ar ? ar.remaining : 0) + (br ? br.remaining : 0),
    })
  }
  return {
    monthly: monthlySchedule.length ? monthlySchedule[0].monthly : 0,
    totalPayment: a.totalPayment + b.totalPayment,
    totalInterest: a.totalInterest + b.totalInterest,
    monthlySchedule,
  }
}

Page({
  data: {
    loanKind: 'commercial',
    calcMode: 'loan',
    commercialInput: '0',
    loanTotal: '0',
    fundAmount: '0',
    totalPrice: '0',
    loanRatio: '6.5',
    commercialYears: 30,
    fundYears: 30,
    rateMode: 'lpr',
    commercialRate: COMMERCIAL_RATE,
    rateFund: FUND_RATE,
    fundRateLabel: FUND_RATE_OPTIONS[0].label,
    lprSuffix: '% (LPR+0基点)',
    derivedTotal: '0',
    derivedCommercial: '0',
    derivedFund: '0',
    repayType: 'equal_installment',
    result: null,
    sheet: { visible: false, field: '', title: '', options: [], index: 0 },
  },

  onLoad(options) {
    if (options.price && Number(options.price) > 0) {
      this.setData({ totalPrice: String(Number(options.price)), calcMode: 'house' }, () => this._updateDerived())
      return
    }
    this._updateDerived()
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [field]: e.detail.value, result: null }, () => this._updateDerived())
  },

  onKindTap(e) {
    const loanKind = e.currentTarget.dataset.val
    if (loanKind === this.data.loanKind) return
    this.setData({ loanKind, result: null }, () => this._updateDerived())
  },

  onModeTap(e) {
    const calcMode = e.currentTarget.dataset.val
    if (calcMode === this.data.calcMode) return
    this.setData({ calcMode, result: null }, () => this._updateDerived())
  },

  onCommercialYearsTap() {
    this._openSheet('commercialYears')
  },

  onFundYearsTap() {
    this._openSheet('fundYears')
  },

  onRateModeTap() {
    this._openSheet('rateMode')
  },

  onFundRateTap() {
    this._openSheet('fundRate')
  },

  _openSheet(field) {
    let options
    let current
    let title
    if (field === 'rateMode') {
      options = RATE_MODE_OPTIONS
      current = this.data.rateMode
      title = '利率方式'
    } else if (field === 'fundRate') {
      options = FUND_RATE_OPTIONS
      current = this.data.rateFund
      title = '公积金利率'
    } else {
      options = YEAR_OPTIONS.map(y => ({ value: y, label: y + '年' }))
      current = this.data[field]
      title = field === 'commercialYears' ? '商贷年限' : '公积金年限'
    }
    const index = Math.max(0, options.findIndex(o => o.value === current))
    this.setData({ sheet: { visible: true, field, title, options, index } })
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
    if (!picked) {
      this.setData({ 'sheet.visible': false })
      return
    }
    const patch = { result: null, 'sheet.visible': false }
    if (field === 'commercialYears' || field === 'fundYears') {
      patch[field] = picked.value
    } else if (field === 'rateMode') {
      patch.rateMode = picked.value
      patch.commercialRate = picked.rate
    } else if (field === 'fundRate') {
      patch.rateFund = picked.value
      patch.fundRateLabel = picked.label
    }
    this.setData(patch)
  },

  noop() {},

  _getAmounts() {
    const { loanKind, calcMode } = this.data
    const houseLoan = roundWan(
      Math.max(0, Number(this.data.totalPrice) || 0) * Math.max(0, Number(this.data.loanRatio) || 0) / 10
    )
    if (loanKind === 'combo') {
      const total = calcMode === 'house' ? houseLoan : Math.max(0, Number(this.data.loanTotal) || 0)
      const fund = Number(this.data.fundAmount) || 0
      return { total, fund, commercial: Math.max(0, total - fund) }
    }
    if (loanKind === 'fund') {
      const fund = calcMode === 'house' ? houseLoan : Number(this.data.fundAmount) || 0
      return { total: fund, fund, commercial: 0 }
    }
    const commercial = calcMode === 'house' ? houseLoan : Math.max(0, Number(this.data.commercialInput) || 0)
    return { total: commercial, fund: 0, commercial }
  },

  _updateDerived() {
    const amounts = this._getAmounts()
    this.setData({
      derivedTotal: displayWan(amounts.total),
      derivedCommercial: displayWan(amounts.commercial),
      derivedFund: displayWan(amounts.fund),
    })
  },

  onCalc() {
    if (this.data.calcMode === 'house') {
      if (!(Number(this.data.totalPrice) > 0)) {
        wx.showToast({ title: '请输入房屋总价', icon: 'none' })
        return
      }
      const ratio = Number(this.data.loanRatio)
      if (!(ratio > 0 && ratio <= 10)) {
        wx.showToast({ title: '请输入有效的贷款比例', icon: 'none' })
        return
      }
    }
    const amounts = this._getAmounts()
    if (!(amounts.total > 0)) {
      const title = this.data.loanKind === 'commercial'
        ? '请输入商贷金额'
        : this.data.loanKind === 'fund' ? '请输入公积金金额' : '请输入贷款总额'
      wx.showToast({ title, icon: 'none' })
      return
    }
    if (this.data.loanKind === 'combo' && (amounts.fund < 0 || amounts.fund > amounts.total)) {
      wx.showToast({ title: '公积金金额不能小于零或超过贷款总额', icon: 'none' })
      return
    }
    this._recalc()
  },

  onTypeTap(e) {
    this.setData({ repayType: e.currentTarget.dataset.val }, () => {
      if (this.data.result) this._recalc()
    })
  },

  onToggleYear(e) {
    const period = e.currentTarget.dataset.period
    const row = this.data.result.schedule[period - 1]
    if (!row) return
    this.setData({ [`result.schedule[${period - 1}].expanded`]: !row.expanded })
  },

  _recalc() {
    const { loanKind, commercialYears, fundYears, repayType } = this.data
    const amounts = this._getAmounts()
    const commYuan = amounts.commercial * 10000
    const fundYuan = amounts.fund * 10000
    const loanYuan = commYuan + fundYuan
    const commRate = Number(this.data.commercialRate) || 3.5
    const fRate = Number(this.data.rateFund) || 2.6
    const selectedCalc = repayType === 'equal_installment' ? calcEqualInstallment : calcEqualPrincipal
    let raw
    let ei
    let ep
    if (loanKind === 'combo') {
      raw = mergeCalc(commYuan, fundYuan, commercialYears, fundYears, commRate, fRate, selectedCalc)
      ei = mergeCalc(commYuan, fundYuan, commercialYears, fundYears, commRate, fRate, calcEqualInstallment)
      ep = mergeCalc(commYuan, fundYuan, commercialYears, fundYears, commRate, fRate, calcEqualPrincipal)
    } else {
      const principal = loanKind === 'commercial' ? commYuan : fundYuan
      const years = loanKind === 'commercial' ? commercialYears : fundYears
      const rate = loanKind === 'commercial' ? commRate : fRate
      raw = selectedCalc(principal, years, rate)
      ei = calcEqualInstallment(principal, years, rate)
      ep = calcEqualPrincipal(principal, years, rate)
    }

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

    const principalPct = raw.totalPayment > 0 ? Math.round((loanYuan / raw.totalPayment) * 100) : 100
    const big = splitMoney(raw.monthly)
    const lastRow = raw.monthlySchedule[raw.monthlySchedule.length - 1]
    const differentTerms = loanKind === 'combo' && commYuan > 0 && fundYuan > 0 && commercialYears !== fundYears
    const eiLastRow = ei.monthlySchedule[ei.monthlySchedule.length - 1]
    const epLastRow = ep.monthlySchedule[ep.monthlySchedule.length - 1]
    this.setData({
      result: {
        monthlyLabel: repayType === 'equal_principal' || differentTerms
          ? (repayType === 'equal_installment' ? '等额本息 · 首月还款' : '等额本金 · 首月还款')
          : '等额本息 · 每月还款',
        monthlyNum: big.num,
        monthlyUnit: big.unit,
        lastMonthlyText: (repayType === 'equal_principal' || differentTerms) && lastRow ? wan(lastRow.monthly) : '',
        decreaseHint: repayType === 'equal_principal' ? ' · 逐月递减' : '',
        loanText: wan(loanYuan),
        totalText: wan(raw.totalPayment),
        interestText: wan(raw.totalInterest),
        monthsText: `${raw.monthlySchedule.length}期 · ${raw.monthlySchedule.length / 12}年`,
        principalPct,
        interestPct: 100 - principalPct,
        compare: {
          ei: {
            monthlyText: differentTerms && eiLastRow
              ? `${wan(ei.monthly)}~${wan(eiLastRow.monthly)}`
              : wan(ei.monthly),
            interestText: wan(ei.totalInterest),
          },
          ep: {
            firstText: wan(ep.monthly),
            lastText: wan(epLastRow ? epLastRow.monthly : ep.monthly),
            interestText: wan(ep.totalInterest),
          },
        },
        schedule,
      },
    })
  },
})

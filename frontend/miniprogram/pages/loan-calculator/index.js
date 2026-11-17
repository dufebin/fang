const { calcEqualInstallment, calcEqualPrincipal } = require('../../utils/loan')

function wan(v) {
  return v >= 10000 ? (v / 10000).toFixed(2) + '万' : Math.round(v) + '元'
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

  onRatioTap(e) {
    this.setData({ downRatio: e.currentTarget.dataset.val })
    this._updateLoan()
  },

  onYearsTap(e) {
    this.setData({ years: e.currentTarget.dataset.val })
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

    const schedule = raw.schedule.map(row => ({
      ...row,
      monthlyText: wan(row.monthly),
      remainingText: wan(row.remaining),
    }))

    // 本息占比（本金 / 还款总额）
    const principalPct = raw.totalPayment > 0
      ? Math.round((loanYuan / raw.totalPayment) * 100)
      : 100
    // 两种还款方式对比（贝壳式并排展示）
    const ei = calcEqualInstallment(loanYuan, years, rateVal)
    const ep = calcEqualPrincipal(loanYuan, years, rateVal)
    this.setData({
      result: {
        monthlyText: wan(raw.monthly),
        lastMonthlyText: repayType === 'equal_principal' && schedule.length
          ? schedule[schedule.length - 1].monthlyText
          : '',
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
            lastText: wan(ep.schedule.length ? ep.schedule[ep.schedule.length - 1].monthly : ep.monthly),
            interestText: wan(ep.totalInterest),
          },
        },
        schedule,
      },
    })
  },
})

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
    downRatios: [0.2, 0.3, 0.4, 0.5],
    yearOptions: [10, 15, 20, 25, 30],
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
  },

  _updateLoan() {
    const totalPrice = Number(this.data.totalPrice)
    if (!totalPrice) { this.setData({ loanAmount: 0 }); return }
    const loanAmount = +(totalPrice * (1 - this.data.downRatio)).toFixed(2)
    this.setData({ loanAmount })
  },

  onCalc() {
    const { loanAmount, years, rate, repayType } = this.data
    if (!loanAmount || loanAmount <= 0) {
      wx.showToast({ title: '请输入房屋总价', icon: 'none' })
      return
    }
    const rateVal = Number(rate) || 3.95
    const loanYuan = loanAmount * 10000
    const raw = repayType === 'equal_installment'
      ? calcEqualInstallment(loanYuan, years, rateVal)
      : calcEqualPrincipal(loanYuan, years, rateVal)

    const schedule = raw.schedule.map(row => ({
      ...row,
      yearlyText: wan(row.yearlyPayment),
      interestText: wan(row.yearlyInterest),
      remainingText: wan(row.remainingPrincipal),
    }))

    this.setData({
      result: {
        monthlyText: wan(raw.monthly),
        totalText: wan(raw.totalPayment),
        interestText: wan(raw.totalInterest),
        schedule,
      },
    })
  },
})

/**
 * 等额本息：每月还款额固定
 * totalLoan: 贷款总额（元）
 * years: 贷款年限
 * rate: 年利率（如 4.2 代表 4.2%）
 */
function calcEqualInstallment(totalLoan, years, rate) {
  const principal = totalLoan
  const monthlyRate = rate / 100 / 12
  const months = years * 12

  if (monthlyRate === 0) {
    const monthly = principal / months
    return {
      monthly: monthly,
      totalPayment: monthly * months,
      totalInterest: 0,
      schedule: _buildEqualSchedule(principal, monthly, monthlyRate, months),
    }
  }

  // 月还款额 = P * r(1+r)^n / [(1+r)^n - 1]
  const factor = Math.pow(1 + monthlyRate, months)
  const monthly = (principal * monthlyRate * factor) / (factor - 1)
  const totalPayment = monthly * months
  const totalInterest = totalPayment - principal

  const monthlySchedule = _buildEqualMonthly(principal, monthly, monthlyRate, months)

  return {
    monthly,
    totalPayment,
    totalInterest,
    schedule: _yearlyFromMonthly(monthlySchedule),
    monthlySchedule,
  }
}

// 等额本息逐月明细
function _buildEqualMonthly(principal, monthly, monthlyRate, months) {
  const rows = []
  let remaining = principal
  for (let i = 1; i <= months; i++) {
    const interest = remaining * monthlyRate
    const principalPart = monthly - interest
    remaining = Math.max(0, remaining - principalPart)
    rows.push({ month: i, monthly, principal: principalPart, interest, remaining })
  }
  return rows
}

// 由逐月明细推导年度汇总（与原 schedule 结构一致）
function _yearlyFromMonthly(monthlySchedule) {
  const schedule = []
  for (let i = 12; i <= monthlySchedule.length; i += 12) {
    schedule.push({
      period: i / 12,
      monthly: monthlySchedule[i - 1].monthly,
      remaining: monthlySchedule[i - 1].remaining,
    })
  }
  return schedule
}

/**
 * 等额本金：每月还款额递减
 * totalLoan: 贷款总额（元）
 */
function calcEqualPrincipal(totalLoan, years, rate) {
  const principal = totalLoan
  const monthlyRate = rate / 100 / 12
  const months = years * 12
  const monthlyPrincipal = principal / months

  let totalInterest = 0
  const monthlySchedule = []

  for (let i = 1; i <= months; i++) {
    const remainingBefore = principal - monthlyPrincipal * (i - 1)
    const interest = remainingBefore * monthlyRate
    totalInterest += interest
    monthlySchedule.push({
      month: i,
      monthly: monthlyPrincipal + interest,
      principal: monthlyPrincipal,
      interest,
      remaining: Math.max(0, remainingBefore - monthlyPrincipal),
    })
  }

  // 首月月供
  const firstMonthly = monthlyPrincipal + principal * monthlyRate

  return {
    monthly: firstMonthly,
    totalPayment: principal + totalInterest,
    totalInterest,
    schedule: _yearlyFromMonthly(monthlySchedule),
    monthlySchedule,
  }
}

// 格式化金额（元 → 万元/元）
function formatMoney(yuan) {
  if (yuan >= 10000) {
    return (yuan / 10000).toFixed(2) + '万元'
  }
  return yuan.toFixed(2) + '元'
}

module.exports = { calcEqualInstallment, calcEqualPrincipal, formatMoney }

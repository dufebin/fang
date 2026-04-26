/**
 * 等额本息：每月还款额固定
 * totalLoan: 贷款总额（万元）
 * years: 贷款年限
 * rate: 年利率（如 4.2 代表 4.2%）
 */
function calcEqualInstallment(totalLoan, years, rate) {
  const principal = totalLoan * 10000
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

  return {
    monthly,
    totalPayment,
    totalInterest,
    schedule: _buildEqualSchedule(principal, monthly, monthlyRate, months),
  }
}

function _buildEqualSchedule(principal, monthly, monthlyRate, months) {
  const schedule = []
  let remaining = principal
  for (let i = 1; i <= months; i++) {
    const interest = remaining * monthlyRate
    const principalPart = monthly - interest
    remaining -= principalPart
    // 只返回年度汇总
    if (i % 12 === 0 || i === months) {
      schedule.push({
        period: Math.ceil(i / 12),
        monthly: monthly,
        remaining: Math.max(0, remaining),
      })
    }
  }
  return schedule
}

/**
 * 等额本金：每月还款额递减
 */
function calcEqualPrincipal(totalLoan, years, rate) {
  const principal = totalLoan * 10000
  const monthlyRate = rate / 100 / 12
  const months = years * 12
  const monthlyPrincipal = principal / months

  let totalInterest = 0
  const schedule = []

  for (let i = 1; i <= months; i++) {
    const remaining = principal - monthlyPrincipal * (i - 1)
    const interest = remaining * monthlyRate
    totalInterest += interest
    const monthly = monthlyPrincipal + interest
    if (i % 12 === 0 || i === months) {
      schedule.push({
        period: Math.ceil(i / 12),
        monthly,
        remaining: Math.max(0, remaining - monthlyPrincipal),
      })
    }
  }

  // 首月月供
  const firstMonthly = monthlyPrincipal + principal * monthlyRate

  return {
    monthly: firstMonthly,
    totalPayment: principal + totalInterest,
    totalInterest,
    schedule,
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

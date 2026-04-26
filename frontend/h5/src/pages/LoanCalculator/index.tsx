import React, { useState } from 'react'
import { NavBar } from 'antd-mobile'
import { useNavigate, useSearchParams } from 'react-router-dom'
import styles from './index.module.css'

interface ScheduleRow { year: number; yearlyPayment: number; yearlyInterest: number; remainingPrincipal: number }
interface CalcResult { monthly: number; totalPayment: number; totalInterest: number; schedule: ScheduleRow[] }

function calcEqualInstallment(loan: number, years: number, rate: number): CalcResult {
  const monthlyRate = rate / 100 / 12
  const n = years * 12
  const monthly = n === 0 ? 0 : loan * monthlyRate * Math.pow(1 + monthlyRate, n) / (Math.pow(1 + monthlyRate, n) - 1)
  const totalPayment = monthly * n
  const totalInterest = totalPayment - loan
  let remaining = loan
  const schedule: ScheduleRow[] = []
  for (let y = 1; y <= years; y++) {
    let yearlyPayment = 0, yearlyInterest = 0
    for (let m = 0; m < 12; m++) {
      const interest = remaining * monthlyRate
      const principal = monthly - interest
      yearlyInterest += interest
      yearlyPayment += monthly
      remaining -= principal
    }
    schedule.push({ year: y, yearlyPayment, yearlyInterest, remainingPrincipal: Math.max(0, remaining) })
  }
  return { monthly, totalPayment, totalInterest, schedule }
}

function calcEqualPrincipal(loan: number, years: number, rate: number): CalcResult {
  const monthlyRate = rate / 100 / 12
  const n = years * 12
  const principalPerMonth = loan / n
  let remaining = loan
  let totalPayment = 0
  const schedule: ScheduleRow[] = []
  const firstMonthly = principalPerMonth + loan * monthlyRate
  for (let y = 1; y <= years; y++) {
    let yearlyPayment = 0, yearlyInterest = 0
    for (let m = 0; m < 12; m++) {
      const interest = remaining * monthlyRate
      yearlyInterest += interest
      yearlyPayment += principalPerMonth + interest
      remaining -= principalPerMonth
    }
    totalPayment += yearlyPayment
    schedule.push({ year: y, yearlyPayment, yearlyInterest, remainingPrincipal: Math.max(0, remaining) })
  }
  return { monthly: firstMonthly, totalPayment, totalInterest: totalPayment - loan, schedule }
}

function wan(v: number) {
  return v >= 10000 ? (v / 10000).toFixed(2) + '万' : Math.round(v) + '元'
}

const DOWN_RATIOS = [0.2, 0.3, 0.4, 0.5]
const YEAR_OPTIONS = [10, 15, 20, 25, 30]

export default function LoanCalculator() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initPrice = searchParams.get('price') || ''

  const [totalPrice, setTotalPrice] = useState(initPrice)
  const [downRatio, setDownRatio] = useState(0.3)
  const [years, setYears] = useState(30)
  const [rate, setRate] = useState('3.95')
  const [repayType, setRepayType] = useState<'equal_installment' | 'equal_principal'>('equal_installment')
  const [result, setResult] = useState<CalcResult | null>(null)

  const loanAmount = totalPrice ? +((Number(totalPrice) * (1 - downRatio)).toFixed(2)) : 0

  const handleCalc = () => {
    if (!loanAmount) return
    const fn = repayType === 'equal_installment' ? calcEqualInstallment : calcEqualPrincipal
    setResult(fn(loanAmount * 10000, years, Number(rate) || 3.95))
  }

  return (
    <div className={styles.page}>
      <NavBar onBack={() => navigate(-1)} className={styles.nav}>贷款计算器</NavBar>

      <div className={styles.card}>
        <div className={styles.sectionTitle}>输入信息</div>

        <div className={styles.formItem}>
          <div className={styles.label}>房屋总价（万元）</div>
          <div className={styles.inputWrap}>
            <input className={styles.input} type="number" placeholder="请输入" value={totalPrice} onChange={e => setTotalPrice(e.target.value)} />
            <span className={styles.unit}>万元</span>
          </div>
        </div>

        <div className={styles.formItem}>
          <div className={styles.label}>首付比例</div>
          <div className={styles.tagRow}>
            {DOWN_RATIOS.map(r => (
              <span key={r} className={`${styles.tag} ${downRatio === r ? styles.tagActive : ''}`} onClick={() => setDownRatio(r)}>
                {r * 100}%
              </span>
            ))}
          </div>
        </div>

        <div className={styles.formItem}>
          <div className={styles.label}>
            <span>贷款金额</span>
            <span className={styles.loanVal}>{loanAmount}万元</span>
          </div>
        </div>

        <div className={styles.formItem}>
          <div className={styles.label}>贷款年限</div>
          <div className={styles.tagRow}>
            {YEAR_OPTIONS.map(y => (
              <span key={y} className={`${styles.tag} ${years === y ? styles.tagActive : ''}`} onClick={() => setYears(y)}>
                {y}年
              </span>
            ))}
          </div>
        </div>

        <div className={styles.formItem}>
          <div className={styles.label}>年利率（%）</div>
          <div className={styles.inputWrap}>
            <input className={styles.input} type="number" placeholder="3.95" value={rate} onChange={e => setRate(e.target.value)} />
            <span className={styles.unit}>%</span>
          </div>
        </div>

        <div className={styles.formItem}>
          <div className={styles.label}>还款方式</div>
          <div className={styles.tagRow}>
            <span className={`${styles.tag} ${repayType === 'equal_installment' ? styles.tagActive : ''}`} onClick={() => setRepayType('equal_installment')}>等额本息</span>
            <span className={`${styles.tag} ${repayType === 'equal_principal' ? styles.tagActive : ''}`} onClick={() => setRepayType('equal_principal')}>等额本金</span>
          </div>
        </div>

        <button className={styles.calcBtn} onClick={handleCalc}>开始计算</button>
      </div>

      {result && (
        <div className={styles.card}>
          <div className={styles.resultRow}>
            <div className={styles.resultItem}>
              <span className={styles.resultLabel}>{repayType === 'equal_installment' ? '每月还款' : '首月还款'}</span>
              <span className={styles.resultVal}>{wan(result.monthly)}</span>
            </div>
            <div className={styles.resultItem}>
              <span className={styles.resultLabel}>还款总额</span>
              <span className={styles.resultVal}>{wan(result.totalPayment)}</span>
            </div>
            <div className={styles.resultItem}>
              <span className={styles.resultLabel}>支付利息</span>
              <span className={`${styles.resultVal} ${styles.red}`}>{wan(result.totalInterest)}</span>
            </div>
          </div>

          <div className={styles.scheduleTitle}>年度还款明细</div>
          <div className={styles.scheduleHeader}>
            <span>年份</span><span>年还款</span><span>年利息</span><span>剩余本金</span>
          </div>
          {result.schedule.map(row => (
            <div key={row.year} className={styles.scheduleRow}>
              <span>第{row.year}年</span>
              <span>{wan(row.yearlyPayment)}</span>
              <span className={styles.red}>{wan(row.yearlyInterest)}</span>
              <span>{wan(row.remainingPrincipal)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

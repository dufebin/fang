import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Home, Newspaper, Calculator } from 'lucide-react'
import styles from './index.module.css'

const ITEMS = [
  { path: '/properties', label: '找房', Icon: Home },
  { path: '/articles', label: '资讯', Icon: Newspaper },
  { path: '/loan-calculator', label: '贷款计算', Icon: Calculator },
]

export default function BottomNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <div className={styles.nav}>
      {ITEMS.map(({ path, label, Icon }) => {
        const active = pathname.startsWith(path)
        return (
          <div
            key={path}
            className={`${styles.item} ${active ? styles.active : ''}`}
            onClick={() => navigate(path)}
          >
            <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
            <span>{label}</span>
          </div>
        )
      })}
    </div>
  )
}

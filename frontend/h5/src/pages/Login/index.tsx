import React, { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Toast } from 'antd-mobile'
import { wechatLogin } from '../../api/agent'
import { useAuthStore } from '../../store/auth'
import styles from './index.module.css'

export default function Login() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()

  useEffect(() => {
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const redirectTo = searchParams.get('redirect_to') || '/'

    if (code) {
      wechatLogin(code).then((res) => {
        if (res.code === 0) {
          const { token, user } = res.data
          setAuth(token, user.role, user.user_id)
          Toast.show({ content: '登录成功', icon: 'success' })
          navigate(redirectTo, { replace: true })
        } else {
          Toast.show({ content: '登录失败，请重试', icon: 'fail' })
        }
      }).catch(() => {
        Toast.show({ content: '网络错误，请重试', icon: 'fail' })
      })
    } else if (state === 'login') {
      // 没有code，触发微信授权
      const currentURL = encodeURIComponent(window.location.origin + redirectTo)
      window.location.href = `/api/auth/wechat/redirect?redirect_to=${currentURL}`
    }
  }, [])

  return (
    <div className={styles.page}>
      <div className={styles.logo}>🏠</div>
      <div className={styles.text}>正在登录...</div>
    </div>
  )
}

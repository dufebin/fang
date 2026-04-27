import React from 'react'
import { Avatar, Button } from 'antd-mobile'
import { Phone, MessageCircle } from 'lucide-react'
import { AgentCard as AgentCardType } from '../../api/property'
import styles from './index.module.css'

interface Props {
  agent: AgentCardType
}

export default function AgentCard({ agent }: Props) {
  const handleCall = () => {
    if (agent.phone) {
      window.location.href = `tel:${agent.phone}`
    }
  }

  const handleWechat = () => {
    if (agent.wechat_id) {
      // 尝试跳转微信（部分设备支持）
      window.location.href = `weixin://dl/chat?${agent.wechat_id}`
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <Avatar
          src={agent.avatar_url || '/default-avatar.png'}
          style={{ '--size': '52px', '--border-radius': '50%' }}
        />
        <div className={styles.info}>
          <div className={styles.name}>{agent.name}</div>
          <div className={styles.bio}>{agent.bio || '专业房产顾问，为您提供优质服务'}</div>
        </div>
      </div>

      <div className={styles.actions}>
        <Button
          color="primary"
          fill="outline"
          className={styles.btn}
          onClick={handleCall}
        >
          <Phone size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          立即致电
        </Button>
        {agent.wechat_id && (
          <Button
            color="success"
            className={styles.btn}
            onClick={handleWechat}
          >
            <MessageCircle size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            微信咨询
          </Button>
        )}
      </div>

      {agent.wechat_qr_url && (
        <div className={styles.qrSection}>
          <p className={styles.qrTip}>长按识别二维码，添加顾问微信</p>
          <img
            src={agent.wechat_qr_url}
            alt="微信二维码"
            className={styles.qrCode}
          />
        </div>
      )}
    </div>
  )
}

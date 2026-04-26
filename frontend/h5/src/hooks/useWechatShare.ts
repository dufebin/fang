import { useEffect } from 'react'
import { getJSSDKConfig } from '../api/agent'

interface ShareConfig {
  title: string
  desc: string
  link: string
  imgUrl: string
}

declare global {
  interface Window {
    wx: WechatJSBridge
  }
}

interface WechatJSBridge {
  config: (cfg: object) => void
  ready: (fn: () => void) => void
  error: (fn: (err: unknown) => void) => void
  updateAppMessageShareData: (cfg: ShareConfig) => void
  updateTimelineShareData: (cfg: ShareConfig) => void
}

export function useWechatShare(config: ShareConfig) {
  useEffect(() => {
    if (typeof window.wx === 'undefined') return

    const currentURL = window.location.href.split('#')[0]
    getJSSDKConfig(currentURL).then((res: unknown) => {
      const data = res as { data: { appId: string; timestamp: number; nonceStr: string; signature: string } }
      window.wx.config({
        debug: false,
        appId: data.data.appId,
        timestamp: data.data.timestamp,
        nonceStr: data.data.nonceStr,
        signature: data.data.signature,
        jsApiList: ['updateAppMessageShareData', 'updateTimelineShareData'],
      })

      window.wx.ready(() => {
        window.wx.updateAppMessageShareData(config)
        window.wx.updateTimelineShareData(config)
      })
    }).catch(() => {})
  }, [config.title, config.link])
}

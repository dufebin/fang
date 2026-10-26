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
    wx?: WechatJSBridge
  }
}

interface WechatJSBridge {
  config: (cfg: object) => void
  ready: (fn: () => void) => void
  error: (fn: (err: unknown) => void) => void
  updateAppMessageShareData: (cfg: ShareConfig) => void
  updateTimelineShareData: (cfg: ShareConfig) => void
}

let sdkPromise: Promise<void> | null = null

function loadWechatSDK() {
  if (window.wx) return Promise.resolve()
  if (sdkPromise) return sdkPromise

  sdkPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://res.wx.qq.com/open/js/jweixin-1.6.0.js'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      script.remove()
      sdkPromise = null
      reject(new Error('微信 JSSDK 加载失败'))
    }
    document.head.appendChild(script)
  })

  return sdkPromise
}

export function useWechatShare(config: ShareConfig, enabled = true) {
  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    const setupShare = async () => {
      try {
        await loadWechatSDK()
        if (cancelled) return

        const currentURL = window.location.href.split('#')[0]
        const res = await getJSSDKConfig(currentURL)
        if (cancelled || !window.wx) return

        const data = res as { data: { appId: string; timestamp: number; nonceStr: string; signature: string } }
        const wx = window.wx
        wx.config({
          debug: false,
          appId: data.data.appId,
          timestamp: data.data.timestamp,
          nonceStr: data.data.nonceStr,
          signature: data.data.signature,
          jsApiList: ['updateAppMessageShareData', 'updateTimelineShareData'],
        })
        wx.ready(() => {
          if (cancelled) return
          wx.updateAppMessageShareData(config)
          wx.updateTimelineShareData(config)
        })
      } catch {
        // 非微信环境或配置失败时保留浏览器默认分享行为
      }
    }

    void setupShare()
    return () => { cancelled = true }
  }, [enabled, config.title, config.desc, config.link, config.imgUrl])
}

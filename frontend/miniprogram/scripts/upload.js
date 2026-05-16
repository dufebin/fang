#!/usr/bin/env node
/**
 * 微信小程序 CI 上传脚本
 * 使用 miniprogram-ci 自动上传代码并生成体验版
 *
 * 环境变量:
 *   PRIVATE_KEY      - 小程序上传密钥内容（GitHub Secrets 传入）
 *   PRIVATE_KEY_PATH - 或指定密钥文件路径（本地开发用）
 *   APPID            - 小程序 AppID（默认从 project.config.json 读取）
 *   VERSION          - 版本号（默认自动生成: YYYY.MM.DD.build)
 *   DESC             - 版本描述（默认取 git commit message）
 */
const ci = require('miniprogram-ci')
const path = require('path')
const { execSync } = require('child_process')
const fs = require('fs')

const PROJECT_DIR = path.resolve(__dirname, '..')
const PROJECT_CONFIG = require(path.join(PROJECT_DIR, 'project.config.json'))
const APPID = process.env.APPID || PROJECT_CONFIG.appid

// 1. 准备私钥
const PRIVATE_KEY = process.env.PRIVATE_KEY
const PRIVATE_KEY_PATH = process.env.PRIVATE_KEY_PATH

let privateKey = null
if (PRIVATE_KEY) {
  // 从环境变量读取密钥内容（GitHub Actions 场景）
  privateKey = PRIVATE_KEY
} else if (PRIVATE_KEY_PATH) {
  // 从文件读取（本地开发场景）
  privateKey = fs.readFileSync(PRIVATE_KEY_PATH, 'utf-8')
} else {
  // 自动查找默认路径
  const defaultKeyPath = path.join(PROJECT_DIR, `private.${APPID}.key`)
  if (fs.existsSync(defaultKeyPath)) {
    privateKey = fs.readFileSync(defaultKeyPath, 'utf-8')
  }
}

if (!privateKey) {
  console.error('错误: 未找到上传密钥。请设置 PRIVATE_KEY 环境变量或 PRIVATE_KEY_PATH。')
  console.error('密钥下载地址: 小程序管理后台 → 开发管理 → 小程序代码上传')
  process.exit(1)
}

// 2. 版本号和描述
const VERSION = process.env.VERSION || (() => {
  const now = new Date()
  const date = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`
  let build = 1
  try {
    const count = execSync('git rev-list --count HEAD', { cwd: PROJECT_DIR, encoding: 'utf-8' }).trim()
    build = count
  } catch (_) {}
  return `${date}.${build}`
})()

const DESC = process.env.DESC || (() => {
  try {
    return execSync('git log -1 --pretty=%s', { cwd: PROJECT_DIR, encoding: 'utf-8' }).trim()
  } catch (_) {
    return `自动部署 ${new Date().toISOString()}`
  }
})()

// 3. 创建 project 对象
const project = new ci.Project({
  appid: APPID,
  type: 'miniProgram',
  projectPath: PROJECT_DIR,
  privateKey,
  ignores: ['node_modules/**/*', '.git/**/*', '.vscode/**/*', '.DS_Store', 'scripts/**/*'],
})

// 4. 上传
async function main() {
  console.log(`[miniprogram-ci] 开始上传...`)
  console.log(`  appid:     ${APPID}`)
  console.log(`  version:   ${VERSION}`)
  console.log(`  desc:      ${DESC}`)
  console.log(`  project:   ${PROJECT_DIR}`)

  try {
    const result = await ci.upload({
      project,
      version: VERSION,
      desc: DESC,
      setting: {
        es6: true,
        es7: true,
        minify: true,
        autoPrefixWXSS: true,
        minifyWXSS: true,
        minifyWXML: true,
      },
      onProgressUpdate: (task) => {
        if (task.status === 'uploading') {
          console.log(`  [进度] ${task.memo || '上传中...'}`)
        }
      },
    })

    console.log(`\n[成功] 上传完成!`)
    console.log(`  版本:     ${VERSION}`)
    console.log(`  子包:     ${result.subPackageInfo ? JSON.stringify(result.subPackageInfo) : '无'}`)
    console.log(`  下次提审建议版本: ${result.suggestedAuditVersion || '无'}`)
  } catch (err) {
    console.error(`\n[失败] 上传出错:`, err.message)
    if (err.message.includes('invalid credential')) {
      console.error('  密钥无效，请重新下载上传密钥。')
    } else if (err.message.includes('rate limit')) {
      console.error('  触发频率限制，请稍后重试。')
    }
    process.exit(1)
  }
}

main()
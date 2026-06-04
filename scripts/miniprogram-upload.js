#!/usr/bin/env node
/**
 * 微信小程序上传脚本
 * 使用 miniprogram-ci 上传代码到微信小程序后台
 * 
 * 用法:
 *   node miniprogram-upload.js [options]
 * 
 * 选项:
 *   --preview    生成预览二维码，不上传
 *   --version    指定版本号（默认从 package.json 读取）
 *   --desc       指定版本描述
 *   --robot      指定 CI 机器人 (1-30，默认 1)
 *   --env        指定环境 (dev/test/prod，默认 prod)
 * 
 * 示例:
 *   node miniprogram-upload.js --version 1.0.0 --desc "首次发布"
 *   node miniprogram-upload.js --preview --env dev
 */

const ci = require('miniprogram-ci');
const path = require('path');
const fs = require('fs');

// ==================== 配置区域 ====================
const CONFIG = {
  // 小程序 appid
  appid: process.env.WX_APPID || 'your-appid-here',
  
  // 项目类型: miniProgram/miniProgramPlugin/miniGame/miniGamePlugin
  type: 'miniProgram',
  
  // 项目路径（包含 project.config.json 的目录）
  projectPath: process.env.WX_PROJECT_PATH || path.join(__dirname, '../dist/build/mp-weixin'),
  
  // 上传密钥路径
  privateKeyPath: process.env.WX_PRIVATE_KEY_PATH || path.join(__dirname, '../private.key'),
  
  // 预览二维码输出路径
  qrcodeOutputPath: path.join(__dirname, '../preview-qrcode.jpg'),
  
  // 编译配置
  setting: {
    es6: true,                    // ES6 转 ES5
    es7: true,                    // 增强转 ES5
    minify: true,                 // 压缩 JS
    minifyWXML: true,             // 压缩 WXML
    minifyWXSS: true,             // 压缩 WXSS
    autoPrefixWXSS: true,         // 自动补全 WXSS
  },
  
  // 忽略文件
  ignores: [
    'node_modules/**/*',
    '**/*.log',
    '.git/**/*',
    '.idea/**/*',
    '.vscode/**/*'
  ]
};

// 多环境配置
const ENV_CONFIG = {
  dev: {
    robot: 2,
    descPrefix: '[开发版]',
    setting: {
      ...CONFIG.setting,
      minify: false  // 开发环境不压缩，方便调试
    }
  },
  test: {
    robot: 3,
    descPrefix: '[测试版]',
    setting: CONFIG.setting
  },
  prod: {
    robot: 1,
    descPrefix: '[正式版]',
    setting: CONFIG.setting
  }
};

// ==================== 工具函数 ====================

/**
 * 解析命令行参数
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    preview: false,
    version: '',
    desc: '',
    robot: 1,
    env: 'prod',
    pagePath: '',
    searchQuery: ''
  };
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--preview':
        options.preview = true;
        break;
      case '--version':
        options.version = args[++i];
        break;
      case '--desc':
        options.desc = args[++i];
        break;
      case '--robot':
        options.robot = parseInt(args[++i]);
        break;
      case '--env':
        options.env = args[++i];
        break;
      case '--page':
        options.pagePath = args[++i];
        break;
      case '--query':
        options.searchQuery = args[++i];
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
        break;
    }
  }
  
  return options;
}

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log(`
微信小程序上传脚本

用法: node miniprogram-upload.js [options]

选项:
  --preview          生成预览二维码，不上传到后台
  --version <ver>    指定版本号（默认从 package.json 读取）
  --desc <text>      指定版本描述
  --robot <num>      指定 CI 机器人 (1-30，默认根据环境)
  --env <env>        指定环境 (dev/test/prod，默认 prod)
  --page <path>      预览页面路径（如 pages/index/index）
  --query <string>   预览页面参数
  --help, -h         显示帮助

示例:
  # 上传正式版
  node miniprogram-upload.js --version 1.0.0 --desc "首次发布"
  
  # 上传开发版
  node miniprogram-upload.js --env dev --version 1.0.0-beta.1 --desc "新功能测试"
  
  # 生成预览二维码
  node miniprogram-upload.js --preview --page pages/index/index

环境变量:
  WX_APPID              小程序 appid
  WX_PROJECT_PATH       项目路径
  WX_PRIVATE_KEY_PATH   上传密钥路径
`);
}

/**
 * 获取版本号
 */
function getVersion() {
  try {
    const pkgPath = path.join(process.cwd(), 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return pkg.version || '1.0.0';
  } catch (e) {
    return '1.0.0';
  }
}

/**
 * 验证配置
 */
function validateConfig() {
  const errors = [];
  
  if (!CONFIG.appid || CONFIG.appid === 'your-appid-here') {
    errors.push('请设置小程序 appid（修改脚本中的 CONFIG.appid 或设置环境变量 WX_APPID）');
  }
  
  if (!fs.existsSync(CONFIG.projectPath)) {
    errors.push(`项目路径不存在: ${CONFIG.projectPath}`);
  }
  
  if (!fs.existsSync(CONFIG.privateKeyPath)) {
    errors.push(`上传密钥文件不存在: ${CONFIG.privateKeyPath}`);
    errors.push('请在微信小程序后台下载上传密钥（开发管理 -> 小程序代码上传）');
  }
  
  if (errors.length > 0) {
    console.error('❌ 配置错误:');
    errors.forEach(err => console.error(`  - ${err}`));
    process.exit(1);
  }
}

/**
 * 创建项目实例
 */
function createProject() {
  return new ci.Project({
    appid: CONFIG.appid,
    type: CONFIG.type,
    projectPath: CONFIG.projectPath,
    privateKeyPath: CONFIG.privateKeyPath,
    ignores: CONFIG.ignores
  });
}

/**
 * 上传代码
 */
async function upload(options) {
  const envConfig = ENV_CONFIG[options.env] || ENV_CONFIG.prod;
  const version = options.version || getVersion();
  const desc = options.desc || `${envConfig.descPrefix} ${new Date().toLocaleString()}`;
  const robot = options.robot || envConfig.robot;
  
  console.log('🚀 开始上传小程序...');
  console.log(`   AppID: ${CONFIG.appid}`);
  console.log(`   版本: ${version}`);
  console.log(`   环境: ${options.env}`);
  console.log(`   机器人: ${robot}`);
  console.log(`   描述: ${desc}`);
  console.log('');
  
  const project = createProject();
  
  try {
    const result = await ci.upload({
      project,
      version,
      desc,
      robot,
      setting: envConfig.setting,
      onProgressUpdate: (info) => {
        if (info._msg) {
          console.log(`   ${info._msg}`);
        }
      }
    });
    
    console.log('');
    console.log('✅ 上传成功！');
    console.log(`   版本: ${result.version}`);
    console.log(`   描述: ${result.desc}`);
    
    return result;
  } catch (error) {
    console.error('❌ 上传失败:', error.message);
    throw error;
  }
}

/**
 * 生成预览
 */
async function preview(options) {
  console.log('📷 生成预览二维码...');
  console.log(`   AppID: ${CONFIG.appid}`);
  console.log(`   页面: ${options.pagePath || '首页'}`);
  console.log('');
  
  const project = createProject();
  
  try {
    const result = await ci.preview({
      project,
      desc: options.desc || `预览 ${new Date().toLocaleString()}`,
      qrcodeOutputDest: CONFIG.qrcodeOutputPath,
      pagePath: options.pagePath || undefined,
      searchQuery: options.searchQuery || undefined,
      setting: CONFIG.setting,
      onProgressUpdate: (info) => {
        if (info._msg) {
          console.log(`   ${info._msg}`);
        }
      }
    });
    
    console.log('');
    console.log('✅ 预览二维码已生成！');
    console.log(`   路径: ${CONFIG.qrcodeOutputPath}`);
    console.log(`   二维码信息: ${result.qrcodeInfo || 'N/A'}`);
    
    return result;
  } catch (error) {
    console.error('❌ 生成预览失败:', error.message);
    throw error;
  }
}

// ==================== 主程序 ====================

async function main() {
  const options = parseArgs();
  
  // 验证配置
  validateConfig();
  
  try {
    if (options.preview) {
      await preview(options);
    } else {
      await upload(options);
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();

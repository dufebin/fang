const ENV = {
  development: {
    BASE_URL: 'http://10.8.51.73:9080/api',
    UPLOAD_BASE: 'http://10.8.51.73:9080',
    H5_BASE_URL: 'http://10.8.51.73:3001', // H5前端地址
  },
  production: {
    BASE_URL: 'https://fapi.deephealth.net/api',
    UPLOAD_BASE: 'https://fapi.deephealth.net',
    H5_BASE_URL: 'https://fapi.deephealth.net', // H5前端地址
  },
}

// 切换环境：改这里
const CURRENT_ENV = 'production'

module.exports = {
  BASE_URL: ENV[CURRENT_ENV].BASE_URL,
  UPLOAD_BASE: ENV[CURRENT_ENV].UPLOAD_BASE,
  H5_BASE_URL: ENV[CURRENT_ENV].H5_BASE_URL,
  // 腾讯地图 WebService API Key，用于逆地理编码（自动定位省市区）
  // 申请地址: https://lbs.qq.com/dev/console/application/mine
  QQMAP_KEY: 'YOUR_QQMAP_KEY',
}

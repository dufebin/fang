const ENV = {
  development: {
    BASE_URL: 'http://10.8.51.73:9080/api',
    UPLOAD_BASE: 'http://10.8.51.73:9080',
    H5_BASE_URL: 'http://10.8.51.73:3001', // H5前端地址
  },
  production: {
    BASE_URL: 'https://your-domain.com/api',
    UPLOAD_BASE: 'https://your-domain.com',
    H5_BASE_URL: 'https://your-domain.com', // H5前端地址
  },
}

// 切换环境：改这里
const CURRENT_ENV = 'development'

module.exports = {
  BASE_URL: ENV[CURRENT_ENV].BASE_URL,
  UPLOAD_BASE: ENV[CURRENT_ENV].UPLOAD_BASE,
  H5_BASE_URL: ENV[CURRENT_ENV].H5_BASE_URL,
}

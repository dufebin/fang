const ENV = {
  development: {
    BASE_URL: 'http://localhost:8080/api',
    UPLOAD_BASE: 'http://localhost:8080',
  },
  production: {
    BASE_URL: 'https://your-domain.com/api',
    UPLOAD_BASE: 'https://your-domain.com',
  },
}

// 切换环境：改这里
const CURRENT_ENV = 'development'

module.exports = {
  BASE_URL: ENV[CURRENT_ENV].BASE_URL,
  UPLOAD_BASE: ENV[CURRENT_ENV].UPLOAD_BASE,
}

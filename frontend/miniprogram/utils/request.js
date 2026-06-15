var config = require('./config')
var auth = require('./auth')

var BASE_URL = config.BASE_URL
var getToken = auth.getToken
var clearToken = auth.clearToken

// 请求去重
var pendingMap = {}
var idCounter = 0

function _nextKey() {
  idCounter++
  return 'req_' + idCounter
}

/**
 * 通用请求封装
 */
function request(opts) {
  opts = opts || {}
  var url = opts.url || ''
  var method = opts.method || 'GET'
  var data = opts.data
  var showLoading = opts.showLoading || false
  var cache = opts.cache || false
  var retry = opts.retry || 0

  if (data && typeof data === 'object') {
    var cleaned = {}
    Object.keys(data).forEach(function(k) {
      if (data[k] !== undefined && data[k] !== null) {
        cleaned[k] = data[k]
      }
    })
    data = cleaned
  }

  return new Promise(function(resolve, reject) {
    if (showLoading) {
      try { wx.showLoading({ title: '加载中...', mask: false }) } catch (_) {}
    }

    function doHideLoading() {
      if (showLoading) {
        try { wx.hideLoading() } catch (_) {}
      }
    }

    function callRequest(attemptLeft) {
      var token = getToken()
      var header = { 'Content-Type': 'application/json' }
      if (token) header['Authorization'] = 'Bearer ' + token

      var reqOptions = {
        url: BASE_URL + url,
        method: method,
        data: data,
        header: header,
        success: function(res) {
          doHideLoading()
          var body = res.data

          // 401: 重新登录
          if (res.statusCode === 401) {
            clearToken()
            try {
              var app = getApp()
              if (app && app.logout) app.logout()
            } catch (_) {}
            reject(new Error('未登录'))
            return
          }

          // 非 2xx HTTP 状态
          if (res.statusCode < 200 || res.statusCode >= 300) {
            var msg = (body && body.message) || ('请求失败 ' + res.statusCode)
            reject(new Error(msg))
            return
          }

          // 解析响应体
          var result = body

          if (body && typeof body === 'object') {
            // 格式: { code: 0, data: ... } 或 { code: 0, list: [...] }
            if ('code' in body) {
              var code = body.code
              if (code === 0 || code === '0' || code === 200 || code === '200') {
                // 优先取 data 字段，没有则用 body 自身（剔除 code/message）
                if (body.data !== undefined) {
                  result = body.data
                } else {
                  // 平铺格式：移除 code、message 字段后返回
                  result = {}
                  Object.keys(body).forEach(function(k) {
                    if (k !== 'code' && k !== 'message' && k !== 'msg') {
                      result[k] = body[k]
                    }
                  })
                }
              } else {
                reject(new Error(body.message || body.msg || '请求失败'))
                return
              }
            }
            // 格式: { success: true, result: ... }
            else if ('success' in body) {
              if (body.success) {
                result = body.result || body.data
              } else {
                reject(new Error(body.message || body.msg || '请求失败'))
                return
              }
            }
            // 纯数据格式（无 code/success）: 直接使用
          }

          resolve(result)
        },
        fail: function(err) {
          doHideLoading()
          console.error('[request]', url, err.errMsg || err)

          if (attemptLeft > 0) {
            setTimeout(function() {
              callRequest(attemptLeft - 1)
            }, 1500)
            return
          }

          reject(err)
        }
      }

      try {
        wx.request(reqOptions)
      } catch (e) {
        doHideLoading()
        console.error('[request] exception:', url, e)
        reject(e)
      }
    }

    callRequest(retry)
  })
}

/**
 * 文件上传
 */
function upload(opts) {
  opts = opts || {}
  var url = opts.url || ''
  var filePath = opts.filePath || ''
  var name = opts.name || 'image'
  var formData = opts.formData

  return new Promise(function(resolve, reject) {
    var token = getToken()
    var header = {}
    if (token) header['Authorization'] = 'Bearer ' + token

    try {
      wx.uploadFile({
        url: BASE_URL + url,
        filePath: filePath,
        name: name,
        formData: formData,
        header: header,
        success: function(res) {
          var statusCode = res && res.statusCode ? res.statusCode : 0
          var raw = res ? res.data : ''

          if (statusCode < 200 || statusCode >= 300) {
            var statusMsg = '上传失败 ' + statusCode
            if (statusCode === 413) {
              statusMsg = '视频文件过大（建议95MB以内）'
            } else {
              try {
                var errBody = typeof raw === 'string' ? JSON.parse(raw) : raw
                if (errBody && (errBody.message || errBody.msg)) {
                  statusMsg = errBody.message || errBody.msg
                }
              } catch (_) {}
            }
            reject(new Error(statusMsg))
            return
          }

          try {
            var body = typeof raw === 'string' ? JSON.parse(raw) : raw
            var result = body
            if (body && typeof body === 'object') {
              if ('code' in body) {
                if (body.code === 0 || body.code === '0' || body.code === 200 || body.code === '200') {
                  result = body.data
                } else {
                  reject(new Error(body.message || '上传失败'))
                  return
                }
              } else if ('success' in body) {
                if (body.success) {
                  result = body.result || body.data
                } else {
                  reject(new Error(body.message || '上传失败'))
                  return
                }
              }
            }
            resolve(result)
          } catch (e) {
            reject(new Error('上传响应解析失败'))
          }
        },
        fail: function(err) {
          reject(new Error((err && err.errMsg) || '上传失败'))
        }
      })
    } catch (e) {
      reject(e)
    }
  })
}

module.exports = {
  request: request,
  upload: upload
}

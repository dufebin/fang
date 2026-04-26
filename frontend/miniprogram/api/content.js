const { request } = require('../utils/request')

// Banner
function listBanners(position = 'home') {
  return request({ url: '/h5/banners', data: { position } })
}

// 资讯列表
function listArticles(params) {
  return request({ url: '/h5/articles', data: params })
}

// 资讯详情
function getArticle(id) {
  return request({ url: `/h5/articles/${id}` })
}

// 区域树
function listAreas() {
  return request({ url: '/h5/areas' })
}

module.exports = { listBanners, listArticles, getArticle, listAreas }

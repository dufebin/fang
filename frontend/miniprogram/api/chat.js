const { request } = require('../utils/request')

function getContacts() {
  return request({ url: '/chat/contacts' })
}

function getConversations() {
  return request({ url: '/chat/conversations' })
}

function getMessages(peerId, page) {
  return request({ url: '/chat/messages', data: { peer_id: peerId, page: page || 1 } })
}

function sendMessage(toUserId, content) {
  return request({ url: '/chat/messages', method: 'POST', data: { to_user_id: toUserId, content: content } })
}

function markRead(peerId) {
  return request({ url: '/chat/messages/read?peer_id=' + peerId, method: 'PUT' })
}

function deleteMessage(id) {
  return request({ url: '/chat/messages/' + id, method: 'DELETE' })
}

function deleteConversation(peerId) {
  return request({ url: '/chat/conversations?peer_id=' + peerId, method: 'DELETE' })
}

module.exports = { getContacts, getConversations, getMessages, sendMessage, markRead, deleteMessage, deleteConversation }

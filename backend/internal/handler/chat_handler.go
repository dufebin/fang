package handler

import (
	"strconv"
	"time"

	"fangchan/internal/middleware"
	"fangchan/internal/model"
	"fangchan/pkg/response"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type ChatHandler struct {
	db *gorm.DB
}

func NewChatHandler(db *gorm.DB) *ChatHandler {
	return &ChatHandler{db: db}
}

// GetContacts GET /chat/contacts
// 返回所有可聊天的用户（排除自己），供新建会话时选择
func (h *ChatHandler) GetContacts(c *gin.Context) {
	me := middleware.GetCurrentUserID(c)
	var users []model.User
	if err := h.db.Where("id != ?", me).
		Select("id, nickname, avatar_url, role").
		Order("nickname asc").
		Limit(200).
		Find(&users).Error; err != nil {
		response.ServerError(c, err)
		return
	}
	response.Success(c, users)
}

// GetConversations GET /chat/conversations
// 返回我的会话列表，每个对象含最后消息和未读数
func (h *ChatHandler) GetConversations(c *gin.Context) {
	me := middleware.GetCurrentUserID(c)

	type convRow struct {
		PeerID  uint64    `gorm:"column:peer_id"`
		LastMsg string    `gorm:"column:last_msg"`
		LastAt  time.Time `gorm:"column:last_at"`
		Unread  int64     `gorm:"column:unread"`
	}

	var rows []convRow
	h.db.Raw(`
		SELECT peer_id,
		       (SELECT content FROM chat_messages m2
		        WHERE (m2.from_user_id = ? AND m2.to_user_id = peer_id)
		           OR (m2.from_user_id = peer_id AND m2.to_user_id = ?)
		        ORDER BY m2.created_at DESC LIMIT 1) AS last_msg,
		       MAX(created_at) AS last_at,
		       SUM(CASE WHEN from_user_id = peer_id AND to_user_id = ? AND is_read = false THEN 1 ELSE 0 END) AS unread
		FROM (
		    SELECT CASE WHEN from_user_id = ? THEN to_user_id ELSE from_user_id END AS peer_id,
		           created_at,
		           from_user_id, to_user_id, is_read
		    FROM chat_messages
		    WHERE from_user_id = ? OR to_user_id = ?
		) t
		GROUP BY peer_id
		ORDER BY last_at DESC
	`, me, me, me, me, me, me).Scan(&rows)

	if len(rows) == 0 {
		response.Success(c, []gin.H{})
		return
	}

	peerIDs := make([]uint64, len(rows))
	for i, r := range rows {
		peerIDs[i] = r.PeerID
	}
	var peers []model.User
	h.db.Where("id IN ?", peerIDs).Select("id, nickname, avatar_url").Find(&peers)
	peerMap := make(map[uint64]model.User, len(peers))
	for _, p := range peers {
		peerMap[p.ID] = p
	}

	result := make([]gin.H, 0, len(rows))
	for _, r := range rows {
		peer := peerMap[r.PeerID]
		result = append(result, gin.H{
			"peer_id":      r.PeerID,
			"peer_name":    peer.Nickname,
			"peer_avatar":  peer.AvatarURL,
			"last_message": r.LastMsg,
			"last_at":      r.LastAt,
			"unread":       r.Unread,
		})
	}
	response.Success(c, result)
}

// GetMessages GET /chat/messages?peer_id=X&page=1
func (h *ChatHandler) GetMessages(c *gin.Context) {
	me := middleware.GetCurrentUserID(c)
	peerID, err := strconv.ParseUint(c.Query("peer_id"), 10, 64)
	if err != nil || peerID == 0 {
		response.BadRequest(c, "无效的 peer_id")
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	if page < 1 {
		page = 1
	}
	limit := 20

	var msgs []model.ChatMessage
	err = h.db.Where(
		"(from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)",
		me, peerID, peerID, me,
	).Order("created_at desc").
		Offset((page - 1) * limit).
		Limit(limit).
		Find(&msgs).Error
	if err != nil {
		response.ServerError(c, err)
		return
	}

	// 反转为时间升序
	for i, j := 0, len(msgs)-1; i < j; i, j = i+1, j-1 {
		msgs[i], msgs[j] = msgs[j], msgs[i]
	}
	response.Success(c, msgs)
}

// SendMessage POST /chat/messages
func (h *ChatHandler) SendMessage(c *gin.Context) {
	me := middleware.GetCurrentUserID(c)
	var req struct {
		ToUserID uint64 `json:"to_user_id" binding:"required"`
		Content  string `json:"content" binding:"required,max=500"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}
	if req.ToUserID == me {
		response.BadRequest(c, "不能给自己发消息")
		return
	}

	msg := model.ChatMessage{
		FromUserID: me,
		ToUserID:   req.ToUserID,
		Content:    req.Content,
	}
	if err := h.db.Create(&msg).Error; err != nil {
		response.ServerError(c, err)
		return
	}
	response.Success(c, msg)
}

// MarkRead PUT /chat/messages/read?peer_id=X
// 将对方发给我的消息永久删除（已看即删）
func (h *ChatHandler) MarkRead(c *gin.Context) {
	me := middleware.GetCurrentUserID(c)
	peerID, err := strconv.ParseUint(c.Query("peer_id"), 10, 64)
	if err != nil || peerID == 0 {
		response.BadRequest(c, "无效的 peer_id")
		return
	}
	h.db.Where("from_user_id = ? AND to_user_id = ?", peerID, me).
		Delete(&model.ChatMessage{})
	response.Success(c, nil)
}

// DeleteConversation DELETE /chat/conversations?peer_id=X
// 删除与某人的全部聊天记录
func (h *ChatHandler) DeleteConversation(c *gin.Context) {
	me := middleware.GetCurrentUserID(c)
	peerID, err := strconv.ParseUint(c.Query("peer_id"), 10, 64)
	if err != nil || peerID == 0 {
		response.BadRequest(c, "无效的 peer_id")
		return
	}
	h.db.Where("(from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)",
		me, peerID, peerID, me).
		Delete(&model.ChatMessage{})
	response.Success(c, nil)
}

// DeleteMessage DELETE /chat/messages/:id
func (h *ChatHandler) DeleteMessage(c *gin.Context) {
	me := middleware.GetCurrentUserID(c)
	msgID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || msgID == 0 {
		response.BadRequest(c, "无效的消息ID")
		return
	}
	result := h.db.Where("id = ? AND (from_user_id = ? OR to_user_id = ?)", msgID, me, me).
		Delete(&model.ChatMessage{})
	if result.RowsAffected == 0 {
		response.BadRequest(c, "消息不存在或无权删除")
		return
	}
	response.Success(c, nil)
}

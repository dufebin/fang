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
		        WHERE ((m2.from_user_id = ? AND m2.to_user_id = peer_id AND m2.deleted_for_from = false)
		           OR (m2.from_user_id = peer_id AND m2.to_user_id = ? AND m2.deleted_for_to = false))
		        ORDER BY m2.created_at DESC LIMIT 1) AS last_msg,
		       MAX(created_at) AS last_at,
		       SUM(CASE WHEN from_user_id = peer_id AND to_user_id = ? AND is_read = false AND deleted_for_to = false THEN 1 ELSE 0 END) AS unread
		FROM (
		    SELECT CASE WHEN from_user_id = ? THEN to_user_id ELSE from_user_id END AS peer_id,
		           created_at,
		           from_user_id, to_user_id, is_read
		    FROM chat_messages
		    WHERE (from_user_id = ? AND deleted_for_from = false)
		       OR (to_user_id = ? AND deleted_for_to = false)
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
		"((from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)) AND "+
			"NOT (from_user_id = ? AND deleted_for_from = true) AND "+
			"NOT (to_user_id = ? AND deleted_for_to = true)",
		me, peerID, peerID, me, me, me,
	).Order("created_at desc").
		Offset((page - 1) * limit).
		Limit(limit).
		Preload("FromUser", func(db *gorm.DB) *gorm.DB {
			return db.Select("id, nickname, avatar_url")
		}).
		Preload("ToUser", func(db *gorm.DB) *gorm.DB {
			return db.Select("id, nickname, avatar_url")
		}).
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
	var fromUser model.User
	h.db.Select("id, nickname, avatar_url").First(&fromUser, me)
	msg.FromUser = &fromUser
	response.Success(c, msg)
}

// MarkRead PUT /chat/messages/read?peer_id=X
// 将对方发给我的消息标记为已读（仅更新未读数），消息保留在会话列表中，需手动删除
func (h *ChatHandler) MarkRead(c *gin.Context) {
	me := middleware.GetCurrentUserID(c)
	peerID, err := strconv.ParseUint(c.Query("peer_id"), 10, 64)
	if err != nil || peerID == 0 {
		response.BadRequest(c, "无效的 peer_id")
		return
	}
	h.db.Model(&model.ChatMessage{}).
		Where("from_user_id = ? AND to_user_id = ? AND is_read = false", peerID, me).
		Update("is_read", true)
	response.Success(c, nil)
}

// DeleteConversation DELETE /chat/conversations?peer_id=X
// 逻辑删除我与某人的全部聊天记录（仅对当前用户隐藏，对方仍可见）
func (h *ChatHandler) DeleteConversation(c *gin.Context) {
	me := middleware.GetCurrentUserID(c)
	peerID, err := strconv.ParseUint(c.Query("peer_id"), 10, 64)
	if err != nil || peerID == 0 {
		response.BadRequest(c, "无效的 peer_id")
		return
	}
	h.db.Model(&model.ChatMessage{}).
		Where("from_user_id = ? AND to_user_id = ? AND deleted_for_from = false", me, peerID).
		Update("deleted_for_from", true)
	h.db.Model(&model.ChatMessage{}).
		Where("from_user_id = ? AND to_user_id = ? AND deleted_for_to = false", peerID, me).
		Update("deleted_for_to", true)
	response.Success(c, nil)
}

// DeleteMessage DELETE /chat/messages/:id
// 逻辑删除单条消息：仅对当前用户隐藏，对方仍可见，数据库保留
func (h *ChatHandler) DeleteMessage(c *gin.Context) {
	me := middleware.GetCurrentUserID(c)
	msgID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || msgID == 0 {
		response.BadRequest(c, "无效的消息ID")
		return
	}
	var msg model.ChatMessage
	if err := h.db.Select("id, from_user_id, to_user_id, deleted_for_from, deleted_for_to").
		First(&msg, msgID).Error; err != nil {
		response.BadRequest(c, "消息不存在或无权删除")
		return
	}
	if msg.FromUserID != me && msg.ToUserID != me {
		response.BadRequest(c, "消息不存在或无权删除")
		return
	}
	var alreadyDeleted bool
	if msg.FromUserID == me && msg.DeletedForFrom {
		alreadyDeleted = true
	} else if msg.ToUserID == me && msg.DeletedForTo {
		alreadyDeleted = true
	}
	if alreadyDeleted {
		response.Success(c, nil)
		return
	}
	if msg.FromUserID == me {
		h.db.Model(&msg).Update("deleted_for_from", true)
	} else {
		h.db.Model(&msg).Update("deleted_for_to", true)
	}
	response.Success(c, nil)
}

package handler

import (
	"strconv"

	"fangchan/internal/middleware"
	"fangchan/internal/repository"
	"fangchan/internal/service"
	"fangchan/pkg/response"

	"github.com/gin-gonic/gin"
)

type ContentHandler struct {
	contentSvc *service.ContentService
}

func NewContentHandler(contentSvc *service.ContentService) *ContentHandler {
	return &ContentHandler{contentSvc: contentSvc}
}

// ---- Public ----

// ListPublicArticles GET /h5/articles
func (h *ContentHandler) ListPublicArticles(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	if page < 1 {
		page = 1
	}
	if limit > 50 {
		limit = 50
	}

	f := repository.ArticleFilter{
		Category: c.Query("category"),
		Status:   "published",
		Keyword:  c.Query("keyword"),
	}

	list, total, err := h.contentSvc.ListArticles(page, limit, f)
	if err != nil {
		response.ServerError(c, err)
		return
	}
	response.SuccessPage(c, list, total, page, limit)
}

// GetPublicArticle GET /h5/articles/:id
func (h *ContentHandler) GetPublicArticle(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的文章ID")
		return
	}
	a, err := h.contentSvc.GetArticle(id)
	if err != nil {
		response.ServerError(c, err)
		return
	}
	if a == nil {
		response.NotFound(c)
		return
	}
	response.Success(c, a)
}

// ListPublicBanners GET /h5/banners
func (h *ContentHandler) ListPublicBanners(c *gin.Context) {
	position := c.DefaultQuery("position", "home")
	list, err := h.contentSvc.ListBanners(position, true)
	if err != nil {
		response.ServerError(c, err)
		return
	}
	response.Success(c, list)
}

// ListAreaTree GET /h5/areas
func (h *ContentHandler) ListAreaTree(c *gin.Context) {
	tree, err := h.contentSvc.ListAreaTree()
	if err != nil {
		response.ServerError(c, err)
		return
	}
	response.Success(c, tree)
}

// ---- Admin ----

// AdminListArticles GET /admin/articles
func (h *ContentHandler) AdminListArticles(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	if page < 1 {
		page = 1
	}

	f := repository.ArticleFilter{
		Category: c.Query("category"),
		Status:   c.Query("status"),
		Keyword:  c.Query("keyword"),
	}
	list, total, err := h.contentSvc.ListArticles(page, limit, f)
	if err != nil {
		response.ServerError(c, err)
		return
	}
	response.SuccessPage(c, list, total, page, limit)
}

// AdminCreateArticle POST /admin/articles
func (h *ContentHandler) AdminCreateArticle(c *gin.Context) {
	var req service.CreateArticleReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	userID := middleware.GetCurrentUserID(c)
	a, err := h.contentSvc.CreateArticle(&req, userID)
	if err != nil {
		response.Fail(c, 500, err.Error())
		return
	}
	response.Success(c, a)
}

// AdminUpdateArticle PUT /admin/articles/:id
func (h *ContentHandler) AdminUpdateArticle(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的文章ID")
		return
	}
	var req service.UpdateArticleReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	a, err := h.contentSvc.UpdateArticle(id, &req)
	if err != nil {
		response.Fail(c, 500, err.Error())
		return
	}
	response.Success(c, a)
}

// AdminDeleteArticle DELETE /admin/articles/:id
func (h *ContentHandler) AdminDeleteArticle(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的文章ID")
		return
	}
	if err := h.contentSvc.DeleteArticle(id); err != nil {
		response.Fail(c, 500, err.Error())
		return
	}
	response.Success(c, gin.H{"deleted": true})
}

// AdminListBanners GET /admin/banners
func (h *ContentHandler) AdminListBanners(c *gin.Context) {
	list, err := h.contentSvc.ListBanners("", false)
	if err != nil {
		response.ServerError(c, err)
		return
	}
	response.Success(c, list)
}

// AdminCreateBanner POST /admin/banners
func (h *ContentHandler) AdminCreateBanner(c *gin.Context) {
	var req service.SaveBannerReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	b, err := h.contentSvc.CreateBanner(&req)
	if err != nil {
		response.Fail(c, 500, err.Error())
		return
	}
	response.Success(c, b)
}

// AdminUpdateBanner PUT /admin/banners/:id
func (h *ContentHandler) AdminUpdateBanner(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的BannerID")
		return
	}
	var req service.SaveBannerReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	b, err := h.contentSvc.UpdateBanner(id, &req)
	if err != nil {
		response.Fail(c, 500, err.Error())
		return
	}
	response.Success(c, b)
}

// AdminDeleteBanner DELETE /admin/banners/:id
func (h *ContentHandler) AdminDeleteBanner(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的BannerID")
		return
	}
	if err := h.contentSvc.DeleteBanner(id); err != nil {
		response.Fail(c, 500, err.Error())
		return
	}
	response.Success(c, gin.H{"deleted": true})
}

// AdminListAreas GET /admin/areas
func (h *ContentHandler) AdminListAreas(c *gin.Context) {
	tree, err := h.contentSvc.ListAreaTree()
	if err != nil {
		response.ServerError(c, err)
		return
	}
	response.Success(c, tree)
}

// AdminCreateArea POST /admin/areas
func (h *ContentHandler) AdminCreateArea(c *gin.Context) {
	var req service.SaveAreaReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	a, err := h.contentSvc.CreateArea(&req)
	if err != nil {
		response.Fail(c, 500, err.Error())
		return
	}
	response.Success(c, a)
}

// AdminUpdateArea PUT /admin/areas/:id
func (h *ContentHandler) AdminUpdateArea(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的区域ID")
		return
	}
	var req service.SaveAreaReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	a, err := h.contentSvc.UpdateArea(id, &req)
	if err != nil {
		response.Fail(c, 500, err.Error())
		return
	}
	response.Success(c, a)
}

// AdminDeleteArea DELETE /admin/areas/:id
func (h *ContentHandler) AdminDeleteArea(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的区域ID")
		return
	}
	if err := h.contentSvc.DeleteArea(id); err != nil {
		response.Fail(c, 500, err.Error())
		return
	}
	response.Success(c, gin.H{"deleted": true})
}

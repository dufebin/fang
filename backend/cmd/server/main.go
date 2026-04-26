package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"fangchan/internal/config"
	"fangchan/internal/handler"
	"fangchan/internal/middleware"
	"fangchan/internal/model"
	"fangchan/internal/repository"
	"fangchan/internal/service"
	"fangchan/pkg/response"
	"fangchan/pkg/storage"
	"fangchan/pkg/wechat"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func main() {
	configPath := os.Getenv("CONFIG_PATH")
	if configPath == "" {
		configPath = "configs/config.yaml"
	}

	cfg, err := config.Load(configPath)
	if err != nil {
		log.Fatalf("加载配置失败: %v", err)
	}

	db, err := initDB(cfg)
	if err != nil {
		log.Fatalf("初始化数据库失败: %v", err)
	}

	if err := db.AutoMigrate(
		&model.User{},
		&model.Agent{},
		&model.Property{},
		&model.PropertyImage{},
		&model.AgentProperty{},
		&model.PropertyView{},
		// 新增模型
		&model.Article{},
		&model.Banner{},
		&model.Area{},
		&model.Favorite{},
		&model.Appointment{},
		&model.BrowseHistory{},
		&model.Notification{},
		&model.AgentApplication{},
	); err != nil {
		log.Fatalf("数据库迁移失败: %v", err)
	}

	rdb := redis.NewClient(&redis.Options{
		Addr:     cfg.Redis.Addr(),
		Password: cfg.Redis.Password,
		DB:       cfg.Redis.DB,
	})

	wxClient := wechat.NewClient(cfg.WeChat.AppID, cfg.WeChat.AppSecret, rdb)

	store, err := storage.NewLocalStorage(cfg.Storage.LocalPath, cfg.Storage.BaseURL)
	if err != nil {
		log.Fatalf("初始化存储失败: %v", err)
	}

	// Repositories
	userRepo := repository.NewUserRepo(db)
	agentRepo := repository.NewAgentRepo(db)
	propertyRepo := repository.NewPropertyRepo(db)
	contentRepo := repository.NewContentRepo(db)
	userActionRepo := repository.NewUserActionRepo(db)
	agentAppRepo := repository.NewAgentApplicationRepo(db)
	statsRepo := repository.NewStatsRepo(db)

	// Services
	authSvc := service.NewAuthService(userRepo, wxClient)
	agentSvc := service.NewAgentService(agentRepo, userRepo)
	propertySvc := service.NewPropertyService(propertyRepo, agentRepo, store)
	contentSvc := service.NewContentService(contentRepo)
	userActionSvc := service.NewUserActionService(userActionRepo, agentRepo)
	agentAppSvc := service.NewAgentApplicationService(agentAppRepo, agentRepo, userRepo)
	statsSvc := service.NewStatsService(statsRepo)

	// Handlers
	authHandler := handler.NewAuthHandler(authSvc, cfg.WeChat.AppID, cfg.WeChat.OAuthRedirectURL)
	propertyHandler := handler.NewPropertyHandler(propertySvc, agentSvc)
	agentHandler := handler.NewAgentHandler(agentSvc, propertySvc, wxClient)
	adminHandler := handler.NewAdminHandler(propertySvc, agentSvc, userRepo, cfg.Admin.Username, cfg.Admin.Password)
	contentHandler := handler.NewContentHandler(contentSvc)
	userActionHandler := handler.NewUserActionHandler(userActionSvc, agentSvc, statsSvc, agentAppSvc)
	statsHandler := handler.NewStatsHandler(statsSvc)
	mpHandler := handler.NewMiniProgramHandler(authSvc, wxClient)

	middleware.SetJWTSecret(cfg.App.JWTSecret)

	if cfg.App.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(gin.Logger())
	r.Use(gin.Recovery())
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	uploadsDir := cfg.Storage.LocalPath
	if err := os.MkdirAll(uploadsDir, 0755); err == nil {
		r.Static("/uploads", uploadsDir)
	}

	registerRoutes(r, authHandler, propertyHandler, agentHandler, adminHandler,
		contentHandler, userActionHandler, statsHandler, mpHandler)

	r.GET("/health", func(c *gin.Context) {
		response.Success(c, gin.H{"status": "ok", "time": time.Now()})
	})

	addr := fmt.Sprintf(":%d", cfg.App.Port)
	log.Printf("服务启动在 %s", addr)
	if err := r.Run(addr); err != nil && err != http.ErrServerClosed {
		log.Fatalf("服务启动失败: %v", err)
	}
}

func registerRoutes(
	r *gin.Engine,
	authH *handler.AuthHandler,
	propertyH *handler.PropertyHandler,
	agentH *handler.AgentHandler,
	adminH *handler.AdminHandler,
	contentH *handler.ContentHandler,
	userActionH *handler.UserActionHandler,
	statsH *handler.StatsHandler,
	mpH *handler.MiniProgramHandler,
) {
	api := r.Group("/api")

	// 认证
	auth := api.Group("/auth")
	{
		auth.GET("/wechat/redirect", authH.WeChatRedirect)
		auth.GET("/wechat/callback", authH.WeChatCallback)
		auth.GET("/me", middleware.AuthRequired(), authH.Me)
	}

	// 小程序登录
	mp := api.Group("/miniprogram")
	{
		mp.POST("/login", mpH.Login)
		mp.PUT("/profile", middleware.AuthRequired(), mpH.UpdateProfile)
	}

	// H5 公开接口
	h5 := api.Group("/h5")
	{
		h5.GET("/properties", propertyH.List)
		h5.GET("/property/:id", propertyH.GetDetail)
		h5.GET("/agent/:agent_code", agentH.GetAgentByCode)
		h5.GET("/wechat/jssdk-config", agentH.GetJSSDKConfig)
		// 内容
		h5.GET("/banners", contentH.ListPublicBanners)
		h5.GET("/articles", contentH.ListPublicArticles)
		h5.GET("/articles/:id", contentH.GetPublicArticle)
		h5.GET("/areas", contentH.ListAreaTree)
	}

	// 登录用户接口（任意角色）
	user := api.Group("/user", middleware.AuthRequired())
	{
		user.POST("/favorites/:property_id", userActionH.ToggleFavorite)
		user.GET("/favorites", userActionH.ListFavorites)
		user.POST("/appointments", userActionH.CreateAppointment)
		user.GET("/appointments", userActionH.ListUserAppointments)
		user.PUT("/appointments/:id/cancel", userActionH.CancelAppointment)
		user.GET("/history", userActionH.ListBrowseHistory)
		user.GET("/notifications", userActionH.ListNotifications)
		user.PUT("/notifications/:id/read", userActionH.MarkNotificationRead)
		user.PUT("/notifications/read-all", userActionH.MarkAllNotificationsRead)
		user.POST("/agent-apply", userActionH.SubmitApplication)
		user.GET("/agent-apply", userActionH.GetMyApplication)
	}

	// 经纪人接口
	agent := api.Group("/agent", middleware.AgentRequired())
	{
		agent.GET("/profile", agentH.GetProfile)
		agent.PUT("/profile", agentH.UpdateProfile)
		agent.GET("/properties", agentH.GetMyProperties)
		agent.GET("/all-properties", propertyH.List)
		agent.POST("/properties", propertyH.Create)
		agent.PUT("/properties/:id", propertyH.UpdateProperty)
		agent.POST("/properties/:id/claim", propertyH.Claim)
		agent.DELETE("/properties/:id/claim", propertyH.Unclaim)
		agent.POST("/properties/:id/images", propertyH.UploadImage)
		agent.GET("/appointments", userActionH.ListAgentAppointments)
		agent.PUT("/appointments/:id/status", userActionH.UpdateAgentAppointmentStatus)
		agent.GET("/stats", userActionH.GetAgentStats)
	}

	// 管理后台登录（无需认证）
	api.POST("/admin/login", adminH.Login)

	// 管理后台
	admin := api.Group("/admin", middleware.AdminRequired())
	{
		// 房源
		admin.GET("/properties", adminH.ListProperties)
		admin.POST("/properties", adminH.CreateProperty)
		admin.POST("/properties/:id/images", adminH.UploadPropertyImage)
		admin.PUT("/properties/:id/status", adminH.UpdatePropertyStatus)
		// 经纪人
		admin.GET("/agents", adminH.ListAgents)
		admin.POST("/agents", adminH.CreateAgent)
		admin.PUT("/agents/:id/status", adminH.SetAgentStatus)
		// 内容管理
		admin.GET("/articles", contentH.AdminListArticles)
		admin.POST("/articles", contentH.AdminCreateArticle)
		admin.PUT("/articles/:id", contentH.AdminUpdateArticle)
		admin.DELETE("/articles/:id", contentH.AdminDeleteArticle)
		admin.GET("/banners", contentH.AdminListBanners)
		admin.POST("/banners", contentH.AdminCreateBanner)
		admin.PUT("/banners/:id", contentH.AdminUpdateBanner)
		admin.DELETE("/banners/:id", contentH.AdminDeleteBanner)
		admin.GET("/areas", contentH.AdminListAreas)
		admin.POST("/areas", contentH.AdminCreateArea)
		admin.PUT("/areas/:id", contentH.AdminUpdateArea)
		admin.DELETE("/areas/:id", contentH.AdminDeleteArea)
		// 预约管理
		admin.GET("/appointments", userActionH.AdminListAppointments)
		admin.PUT("/appointments/:id/status", userActionH.AdminUpdateAppointmentStatus)
		// 经纪人入驻申请
		admin.GET("/applications", userActionH.AdminListApplications)
		admin.PUT("/applications/:id/review", userActionH.AdminReviewApplication)
		// 用户管理
		admin.GET("/users", adminH.ListUsers)
		// 消息通知
		admin.POST("/notifications/broadcast", userActionH.AdminBroadcast)
		admin.POST("/notifications/send", userActionH.AdminSendNotification)
		// 数据统计
		admin.GET("/stats/overview", statsH.Overview)
		admin.GET("/stats/property-types", statsH.PropertyTypeDistribution)
		admin.GET("/stats/agent-ranking", statsH.AgentRanking)
		admin.GET("/stats/view-trend", statsH.ViewTrend)
		admin.GET("/stats/funnel", statsH.ConversionFunnel)
	}
}

func initDB(cfg *config.Config) (*gorm.DB, error) {
	logLevel := logger.Info
	if cfg.App.Env == "production" {
		logLevel = logger.Error
	}

	newLogger := logger.New(
		log.New(os.Stdout, "\r\n", log.LstdFlags),
		logger.Config{
			SlowThreshold:             200 * time.Millisecond,
			LogLevel:                  logLevel,
			IgnoreRecordNotFoundError: true,
			Colorful:                  true,
		},
	)

	db, err := gorm.Open(mysql.Open(cfg.Database.DSN()), &gorm.Config{
		Logger: newLogger,
	})
	if err != nil {
		return nil, err
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}

	sqlDB.SetMaxOpenConns(cfg.Database.MaxOpenConns)
	sqlDB.SetMaxIdleConns(cfg.Database.MaxIdleConns)
	sqlDB.SetConnMaxLifetime(time.Hour)

	return db, nil
}

func init() {
	dirs := []string{"uploads", filepath.Join("uploads", "2024")}
	for _, dir := range dirs {
		_ = os.MkdirAll(dir, 0755)
	}
}

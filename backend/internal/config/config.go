package config

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

type Config struct {
	App      AppConfig      `yaml:"app"`
	Admin    AdminConfig    `yaml:"admin"`
	Database DatabaseConfig `yaml:"database"`
	Redis    RedisConfig    `yaml:"redis"`
	WeChat   WeChatConfig   `yaml:"wechat"`
	Storage  StorageConfig  `yaml:"storage"`
}

type AdminConfig struct {
	Username string `yaml:"username"`
	Password string `yaml:"password"`
}

type AppConfig struct {
	Name            string `yaml:"name"`
	Env             string `yaml:"env"`
	Port            int    `yaml:"port"`
	JWTSecret       string `yaml:"jwt_secret"`
	JWTExpireHours  int    `yaml:"jwt_expire_hours"`
}

type DatabaseConfig struct {
	Host         string `yaml:"host"`
	Port         int    `yaml:"port"`
	User         string `yaml:"user"`
	Password     string `yaml:"password"`
	Name         string `yaml:"name"`
	MaxOpenConns int    `yaml:"max_open_conns"`
	MaxIdleConns int    `yaml:"max_idle_conns"`
}

type RedisConfig struct {
	Host     string `yaml:"host"`
	Port     int    `yaml:"port"`
	Password string `yaml:"password"`
	DB       int    `yaml:"db"`
}

type WeChatConfig struct {
	AppID            string `yaml:"app_id"`
	AppSecret        string `yaml:"app_secret"`
	Token            string `yaml:"token"`
	EncodingAESKey   string `yaml:"encoding_aes_key"`
	OAuthRedirectURL string `yaml:"oauth_redirect_url"`
}

type StorageConfig struct {
	Type      string    `yaml:"type"`
	LocalPath string    `yaml:"local_path"`
	BaseURL   string    `yaml:"base_url"`
	COS       COSConfig `yaml:"cos"`
}

type COSConfig struct {
	SecretID  string `yaml:"secret_id"`
	SecretKey string `yaml:"secret_key"`
	Bucket    string `yaml:"bucket"`
	Region    string `yaml:"region"`
}

func (d *DatabaseConfig) DSN() string {
	return fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		d.User, d.Password, d.Host, d.Port, d.Name)
}

func (r *RedisConfig) Addr() string {
	return fmt.Sprintf("%s:%d", r.Host, r.Port)
}

func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read config file: %w", err)
	}

	// 替换环境变量
	data = []byte(os.ExpandEnv(string(data)))

	cfg := &Config{}
	if err := yaml.Unmarshal(data, cfg); err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}

	overrideFromEnv(cfg)
	return cfg, nil
}

func overrideFromEnv(cfg *Config) {
	if v := os.Getenv("DB_HOST"); v != "" {
		cfg.Database.Host = v
	}
	if v := os.Getenv("DB_PORT"); v != "" {
		fmt.Sscanf(v, "%d", &cfg.Database.Port)
	}
	if v := os.Getenv("DB_USER"); v != "" {
		cfg.Database.User = v
	}
	if v := os.Getenv("DB_PASSWORD"); v != "" {
		cfg.Database.Password = v
	}
	if v := os.Getenv("DB_NAME"); v != "" {
		cfg.Database.Name = v
	}
	if v := os.Getenv("REDIS_HOST"); v != "" {
		cfg.Redis.Host = v
	}
	if v := os.Getenv("REDIS_PORT"); v != "" {
		fmt.Sscanf(v, "%d", &cfg.Redis.Port)
	}
	if v := os.Getenv("JWT_SECRET"); v != "" {
		cfg.App.JWTSecret = v
	}
	if v := os.Getenv("ADMIN_USERNAME"); v != "" {
		cfg.Admin.Username = v
	}
	if v := os.Getenv("ADMIN_PASSWORD"); v != "" {
		cfg.Admin.Password = v
	}
	if v := os.Getenv("WECHAT_APP_ID"); v != "" {
		cfg.WeChat.AppID = v
	}
	if v := os.Getenv("WECHAT_APP_SECRET"); v != "" {
		cfg.WeChat.AppSecret = v
	}
}

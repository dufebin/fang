package service

import (
	"fmt"

	"fangchan/internal/middleware"
	"fangchan/internal/model"
	"fangchan/internal/repository"
	"fangchan/pkg/wechat"
)

type AuthService struct {
	userRepo *repository.UserRepo
	wx       *wechat.Client
}

func NewAuthService(userRepo *repository.UserRepo, wx *wechat.Client) *AuthService {
	return &AuthService{userRepo: userRepo, wx: wx}
}

type LoginResult struct {
	Token string      `json:"token"`
	User  *model.User `json:"user"`
}

// LoginOrRegisterByOpenID 小程序登录/注册（通过 openid）
func (s *AuthService) LoginOrRegisterByOpenID(openID, unionID, nickname, avatar string) (*model.User, string, error) {
	user, err := s.userRepo.FindByOpenID(openID)
	if err != nil {
		return nil, "", err
	}
	if user == nil {
		user = &model.User{
			OpenID:    openID,
			UnionID:   unionID,
			Nickname:  nickname,
			AvatarURL: avatar,
			Role:      model.RoleUser,
		}
		if err := s.userRepo.Create(user); err != nil {
			return nil, "", err
		}
	} else {
		if nickname != "" {
			user.Nickname = nickname
		}
		if avatar != "" {
			user.AvatarURL = avatar
		}
		if unionID != "" {
			user.UnionID = unionID
		}
		_ = s.userRepo.Update(user)
	}

	token, err := middleware.GenerateToken(user.ID, user.OpenID, user.Role)
	if err != nil {
		return nil, "", err
	}
	return user, token, nil
}

// UpdateUserProfile 更新用户资料
func (s *AuthService) UpdateUserProfile(userID uint64, nickname, avatar, phone string) (*model.User, error) {
	user, err := s.userRepo.FindByID(userID)
	if err != nil || user == nil {
		return nil, fmt.Errorf("用户不存在")
	}
	if nickname != "" {
		user.Nickname = nickname
	}
	if avatar != "" {
		user.AvatarURL = avatar
	}
	if phone != "" {
		user.Phone = phone
	}
	return user, s.userRepo.Update(user)
}

// WeChatLogin 微信授权码登录
func (s *AuthService) WeChatLogin(code string) (*LoginResult, error) {
	token, err := s.wx.GetOAuthToken(code)
	if err != nil {
		return nil, err
	}

	userInfo, err := s.wx.GetUserInfo(token.AccessToken, token.OpenID)
	if err != nil {
		return nil, err
	}

	user, err := s.userRepo.FindByOpenID(token.OpenID)
	if err != nil {
		return nil, err
	}

	if user == nil {
		user = &model.User{
			OpenID:    token.OpenID,
			UnionID:   token.UnionID,
			Nickname:  userInfo.Nickname,
			AvatarURL: userInfo.HeadImgURL,
			Role:      model.RoleUser,
		}
		if err := s.userRepo.Create(user); err != nil {
			return nil, err
		}
	} else {
		// 更新昵称和头像
		user.Nickname = userInfo.Nickname
		user.AvatarURL = userInfo.HeadImgURL
		if token.UnionID != "" {
			user.UnionID = token.UnionID
		}
		_ = s.userRepo.Update(user)
	}

	jwtToken, err := middleware.GenerateToken(user.ID, user.OpenID, user.Role)
	if err != nil {
		return nil, err
	}

	return &LoginResult{Token: jwtToken, User: user}, nil
}

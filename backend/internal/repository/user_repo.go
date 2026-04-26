package repository

import (
	"fangchan/internal/model"

	"gorm.io/gorm"
)

type UserRepo struct {
	db *gorm.DB
}

func NewUserRepo(db *gorm.DB) *UserRepo {
	return &UserRepo{db: db}
}

func (r *UserRepo) FindByOpenID(openID string) (*model.User, error) {
	var user model.User
	err := r.db.Where("openid = ?", openID).First(&user).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &user, err
}

func (r *UserRepo) Create(user *model.User) error {
	return r.db.Create(user).Error
}

func (r *UserRepo) Update(user *model.User) error {
	return r.db.Save(user).Error
}

func (r *UserRepo) FindByID(id uint64) (*model.User, error) {
	var user model.User
	err := r.db.First(&user, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &user, err
}

func (r *UserRepo) List(page, limit int, keyword, role string) ([]*model.User, int64, error) {
	q := r.db.Model(&model.User{})
	if keyword != "" {
		like := "%" + keyword + "%"
		q = q.Where("nickname LIKE ? OR phone LIKE ?", like, like)
	}
	if role != "" {
		q = q.Where("role = ?", role)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var users []*model.User
	offset := (page - 1) * limit
	err := q.Order("id DESC").Offset(offset).Limit(limit).Find(&users).Error
	return users, total, err
}

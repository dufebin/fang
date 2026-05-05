package storage

import (
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type Storage interface {
	Save(file multipart.File, header *multipart.FileHeader) (string, error)
	Delete(url string) error
}

type LocalStorage struct {
	BasePath string
	BaseURL  string
}

func NewLocalStorage(basePath, baseURL string) (*LocalStorage, error) {
	if err := os.MkdirAll(basePath, 0755); err != nil {
		return nil, fmt.Errorf("create storage dir: %w", err)
	}
	return &LocalStorage{BasePath: basePath, BaseURL: baseURL}, nil
}

func (s *LocalStorage) Save(file multipart.File, header *multipart.FileHeader) (string, error) {
	ext := strings.ToLower(filepath.Ext(header.Filename))
	if !isAllowedImageExt(ext) {
		return "", fmt.Errorf("不支持的文件类型: %s", ext)
	}

	// 按日期分目录
	dir := filepath.Join(s.BasePath, time.Now().Format("2006/01"))
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", fmt.Errorf("create dir: %w", err)
	}

	filename := fmt.Sprintf("%d%s", time.Now().UnixNano(), ext)
	dst := filepath.Join(dir, filename)

	out, err := os.Create(dst)
	if err != nil {
		return "", fmt.Errorf("create file: %w", err)
	}
	defer out.Close()

	if _, err := io.Copy(out, file); err != nil {
		return "", fmt.Errorf("write file: %w", err)
	}

	// 返回可访问的URL
	relPath := strings.TrimPrefix(dst, filepath.Clean(s.BasePath))
	relPath = strings.ReplaceAll(relPath, string(os.PathSeparator), "/")
	return s.BaseURL + relPath, nil
}

func (s *LocalStorage) Delete(fileURL string) error {
	if !strings.HasPrefix(fileURL, s.BaseURL) {
		return nil
	}
	relPath := strings.TrimPrefix(fileURL, s.BaseURL)
	fullPath := filepath.Join(s.BasePath, relPath)
	return os.Remove(fullPath)
}

func isAllowedImageExt(ext string) bool {
	allowed := map[string]bool{
		".jpg": true, ".jpeg": true, ".png": true,
		".gif": true, ".webp": true,
	}
	return allowed[ext]
}

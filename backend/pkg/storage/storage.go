package storage

import (
	"bytes"
	"fmt"
	"image"
	"image/jpeg"
	_ "image/png"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// Storage abstracts file persistence. Save/SaveVideo return the stored key.
// URL() resolves any stored value — new key, legacy "/uploads/..." path, or
// already-absolute URL — to a publicly accessible URL. Switching buckets or
// CDN only requires a config change; no DB migration needed.
type Storage interface {
	Save(file multipart.File, header *multipart.FileHeader) (string, error)
	SaveVideo(file multipart.File, header *multipart.FileHeader) (string, error)
	Delete(key string) error
	URL(key string) string
}

type LocalStorage struct {
	BasePath string
	BaseURL  string
	urlPath  string
}

func NewLocalStorage(basePath, baseURL string) (*LocalStorage, error) {
	if err := os.MkdirAll(basePath, 0755); err != nil {
		return nil, fmt.Errorf("create storage dir: %w", err)
	}
	urlPath := "/uploads"
	if u, err := url.Parse(baseURL); err == nil {
		urlPath = strings.TrimRight(u.Path, "/")
	}
	return &LocalStorage{BasePath: basePath, BaseURL: baseURL, urlPath: urlPath}, nil
}

func (s *LocalStorage) Save(file multipart.File, header *multipart.FileHeader) (string, error) {
	// 读取文件内容
	fileBytes, err := io.ReadAll(file)
	if err != nil {
		return "", fmt.Errorf("read file: %w", err)
	}

	// 优先用文件名扩展名，扩展名缺失或不认识时从内容检测
	// 微信头像临时路径上传后 header.Filename 可能没有合法扩展名
	ext := strings.ToLower(filepath.Ext(header.Filename))
	if !isAllowedImageExt(ext) {
		ct := http.DetectContentType(fileBytes)
		ext = mimeToExt(ct)
		if ext == "" {
			return "", fmt.Errorf("不支持的文件类型：%s", ct)
		}
	}

	// 如果文件超过 200KB，尝试压缩
	const MaxSize = 200 * 1024 // 200KB
	if len(fileBytes) > MaxSize {
		fileBytes, err = compressImage(fileBytes, ext, MaxSize)
		if err != nil {
			return "", fmt.Errorf("compress image: %w", err)
		}
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

	if _, err := out.Write(fileBytes); err != nil {
		return "", fmt.Errorf("write file: %w", err)
	}

	// 返回可访问的 URL
	absDst, err := filepath.Abs(dst)
	if err != nil {
		absDst = dst
	}
	absBase, err := filepath.Abs(s.BasePath)
	if err != nil {
		absBase = s.BasePath
	}
	relPath := strings.TrimPrefix(absDst, absBase)
	relPath = strings.ReplaceAll(relPath, string(os.PathSeparator), "/")
	return s.urlPath + relPath, nil
}

func (s *LocalStorage) URL(key string) string {
	if strings.HasPrefix(key, "http://") || strings.HasPrefix(key, "https://") {
		return key
	}
	// strip urlPath prefix to avoid doubling it when BaseURL already contains the path
	key = strings.TrimPrefix(key, s.urlPath)
	key = strings.TrimPrefix(key, "/")
	return strings.TrimRight(s.BaseURL, "/") + "/" + key
}

func (s *LocalStorage) Delete(key string) error {
	// accept both a stored key and a full URL
	key = strings.TrimPrefix(key, s.BaseURL)
	key = strings.TrimPrefix(key, s.urlPath)
	key = strings.TrimPrefix(key, "/")
	if key == "" {
		return nil
	}
	return os.Remove(filepath.Join(s.BasePath, filepath.FromSlash(key)))
}

func (s *LocalStorage) SaveVideo(file multipart.File, header *multipart.FileHeader) (string, error) {
	ext := strings.ToLower(filepath.Ext(header.Filename))
	if !isAllowedVideoExt(ext) {
		return "", fmt.Errorf("不支持的视频类型: %s", ext)
	}

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

	absDst, err := filepath.Abs(dst)
	if err != nil {
		absDst = dst
	}
	absBase, err := filepath.Abs(s.BasePath)
	if err != nil {
		absBase = s.BasePath
	}
	relPath := strings.TrimPrefix(absDst, absBase)
	relPath = strings.ReplaceAll(relPath, string(os.PathSeparator), "/")
	return s.urlPath + relPath, nil
}

func isAllowedImageExt(ext string) bool {
	allowed := map[string]bool{
		".jpg": true, ".jpeg": true, ".png": true,
		".gif": true, ".webp": true,
	}
	return allowed[ext]
}

func mimeToExt(ct string) string {
	switch {
	case strings.HasPrefix(ct, "image/jpeg"):
		return ".jpg"
	case strings.HasPrefix(ct, "image/png"):
		return ".png"
	case strings.HasPrefix(ct, "image/gif"):
		return ".gif"
	case strings.HasPrefix(ct, "image/webp"):
		return ".webp"
	default:
		return ""
	}
}

func isAllowedVideoExt(ext string) bool {
	allowed := map[string]bool{
		".mp4": true, ".mov": true, ".avi": true, ".webm": true, ".mkv": true,
	}
	return allowed[ext]
}

// compressImage 压缩图片到指定大小以内
// 使用逐步降低质量的方式，直到文件大小满足要求
func compressImage(data []byte, ext string, maxSize int) ([]byte, error) {
	if len(data) <= maxSize {
		return data, nil
	}

	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return data, nil
	}

	var lastResult []byte
	for quality := 90; quality >= 20; quality -= 10 {
		var buf bytes.Buffer
		if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: quality}); err != nil {
			continue
		}
		lastResult = buf.Bytes()
		if len(lastResult) <= maxSize {
			return lastResult, nil
		}
	}

	if lastResult != nil {
		return lastResult, nil
	}
	return data, nil
}

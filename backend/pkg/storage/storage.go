package storage

import (
	"bytes"
	"fmt"
	"image"
	"image/color"
	_ "image/gif" // 注册 gif 解码器，缩略图支持 gif 源
	"image/jpeg"
	_ "image/png"
	"io"
	"log"
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

	// 生成缩略图（纯优化，失败不影响原图保存）
	if _, err := EnsureThumbnail(dst); err != nil {
		log.Printf("生成缩略图失败 %s: %v", dst, err)
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
	if err := os.Remove(filepath.Join(s.BasePath, filepath.FromSlash(key))); err != nil {
		return err
	}
	// 连带删除缩略图（视频或缩略图不存在时忽略）
	_ = os.Remove(filepath.Join(s.BasePath, filepath.FromSlash(filepath.Dir(key)), thumbFilename(filepath.Base(key))))
	return nil
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

// ---------- 缩略图 ----------

const (
	thumbMaxWidth = 500
	thumbQuality  = 75
)

// thumbFilename 返回缩略图文件名：123.jpg → 123_thumb.jpg（源是 png/gif 也输出 jpg）
func thumbFilename(name string) string {
	ext := filepath.Ext(name)
	return strings.TrimSuffix(name, ext) + "_thumb.jpg"
}

// ThumbPath 返回 path 对应的缩略图路径（同目录 <stem>_thumb.jpg）。
func ThumbPath(path string) string {
	return filepath.Join(filepath.Dir(path), thumbFilename(filepath.Base(path)))
}

// EnsureThumbnail 为 path 生成缺失的缩略图（仅当原图为受支持的图片且宽 > thumbMaxWidth）。
// 返回是否写入了缩略图。已存在/小图/无法解码（如 webp）返回 (false, nil)，不视为错误。
func EnsureThumbnail(path string) (bool, error) {
	if !isAllowedImageExt(strings.ToLower(filepath.Ext(path))) {
		return false, nil
	}
	thumb := ThumbPath(path)
	if _, err := os.Stat(thumb); err == nil {
		return false, nil // 已存在
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return false, err
	}
	out, ok := thumbnailBytes(data)
	if !ok {
		return false, nil
	}
	return true, os.WriteFile(thumb, out, 0644)
}

// thumbnailBytes 生成缩略图 JPEG；宽 ≤ thumbMaxWidth 或无法解码时 ok=false
func thumbnailBytes(data []byte) ([]byte, bool) {
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, false
	}
	b := img.Bounds()
	if b.Dx() <= thumbMaxWidth {
		return nil, false
	}
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, downscale(img, thumbMaxWidth), &jpeg.Options{Quality: thumbQuality}); err != nil {
		return nil, false
	}
	return buf.Bytes(), true
}

// downscale 将图片等比缩小到目标宽（box-filter 下采样平均，白底合成 alpha）
func downscale(img image.Image, targetW int) *image.RGBA {
	b := img.Bounds()
	srcW, srcH := b.Dx(), b.Dy()
	targetH := srcH * targetW / srcW
	if targetH < 1 {
		targetH = 1
	}
	dst := image.NewRGBA(image.Rect(0, 0, targetW, targetH))
	for dy := 0; dy < targetH; dy++ {
		sy0 := dy * srcH / targetH
		sy1 := (dy + 1) * srcH / targetH
		if sy1 <= sy0 {
			sy1 = sy0 + 1
		}
		for dx := 0; dx < targetW; dx++ {
			sx0 := dx * srcW / targetW
			sx1 := (dx + 1) * srcW / targetW
			if sx1 <= sx0 {
				sx1 = sx0 + 1
			}
			var rSum, gSum, bSum, aSum, n uint64
			for y := sy0; y < sy1; y++ {
				for x := sx0; x < sx1; x++ {
					pr, pg, pb, pa := img.At(b.Min.X+x, b.Min.Y+y).RGBA()
					rSum += uint64(pr)
					gSum += uint64(pg)
					bSum += uint64(pb)
					aSum += uint64(pa)
					n++
				}
			}
			// 平均后在白底上合成（JPEG 无 alpha 通道）
			dst.SetRGBA(dx, dy, color.RGBA{
				R: uint8((rSum/n + 65535 - aSum/n) * 255 / 65535),
				G: uint8((gSum/n + 65535 - aSum/n) * 255 / 65535),
				B: uint8((bSum/n + 65535 - aSum/n) * 255 / 65535),
				A: 255,
			})
		}
	}
	return dst
}

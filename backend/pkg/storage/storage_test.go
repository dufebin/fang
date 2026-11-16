package storage

import (
	"bytes"
	"encoding/base64"
	"image"
	"image/color"
	"image/jpeg"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// jpegBytes 生成一张纯色测试 JPEG
func jpegBytes(t *testing.T, w, h int) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, color.RGBA{R: 200, G: 100, B: 50, A: 255})
		}
	}
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: 90}); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

// writeFile 把图片写进临时目录，返回文件路径
func writeFile(t *testing.T, data []byte) string {
	t.Helper()
	dir := t.TempDir()
	p := filepath.Join(dir, "123.jpg")
	if err := os.WriteFile(p, data, 0644); err != nil {
		t.Fatal(err)
	}
	return p
}

func TestThumbPath(t *testing.T) {
	got := ThumbPath("/data/uploads/2026/11/123.jpg")
	want := "/data/uploads/2026/11/123_thumb.jpg"
	if got != want {
		t.Errorf("ThumbPath = %q, want %q", got, want)
	}
}

func TestEnsureThumbnailGenerates(t *testing.T) {
	p := writeFile(t, jpegBytes(t, 800, 600))
	ok, err := EnsureThumbnail(p)
	if err != nil || !ok {
		t.Fatalf("EnsureThumbnail = (%v, %v), want (true, nil)", ok, err)
	}
	f, err := os.Open(ThumbPath(p))
	if err != nil {
		t.Fatalf("缩略图未生成: %v", err)
	}
	defer f.Close()
	cfg, _, err := image.DecodeConfig(f)
	if err != nil {
		t.Fatalf("缩略图解码失败: %v", err)
	}
	if cfg.Width != 500 {
		t.Errorf("缩略图宽度 = %d, want 500", cfg.Width)
	}
}

func TestEnsureThumbnailIdempotent(t *testing.T) {
	p := writeFile(t, jpegBytes(t, 800, 600))
	if ok, _ := EnsureThumbnail(p); !ok {
		t.Fatal("首次应生成")
	}
	if ok, err := EnsureThumbnail(p); ok || err != nil {
		t.Errorf("重复调用 = (%v, %v), want (false, nil)", ok, err)
	}
}

func TestEnsureThumbnailSkipsSmallImage(t *testing.T) {
	p := writeFile(t, jpegBytes(t, 400, 300))
	ok, err := EnsureThumbnail(p)
	if ok || err != nil {
		t.Fatalf("小图 = (%v, %v), want (false, nil)", ok, err)
	}
	if _, err := os.Stat(ThumbPath(p)); !os.IsNotExist(err) {
		t.Error("小图不应生成缩略图文件")
	}
}

func TestEnsureThumbnailSkipsUndecodable(t *testing.T) {
	// webp：Go 标准库无法解码，应静默跳过
	dir := t.TempDir()
	p := filepath.Join(dir, "456.webp")
	if err := os.WriteFile(p, []byte("RIFF\x24\x00\x00\x00WEBPVP8 fake"), 0644); err != nil {
		t.Fatal(err)
	}
	ok, err := EnsureThumbnail(p)
	if ok || err != nil {
		t.Fatalf("webp = (%v, %v), want (false, nil)", ok, err)
	}
}

// gifFixtureB64 是一张 501x10 纯色 gif 的 base64（宽 > thumbMaxWidth 才会生成缩略图）。
// 预生成字节而非在测试里 import image/gif：那会在测试二进制注册 gif 解码器，
// 让本回归测试发现不了 storage.go 漏掉 _ "image/gif" 的情况。
const gifFixtureB64 = "R0lGODlh9QEKAIEAAMhkMgAAAP///x48WiwAAAAA9QEKAAACTYSPqcvtD6OctNqLs968+w+G4kiW5omm6sq27gvH8kzX9o3n+s73/g8MCofEovGITCqXzKbzCY1Kp9Sq9YrNarfcrvcLDovH5LL5DCwAADs="

func TestEnsureThumbnailGeneratesForGif(t *testing.T) {
	// 源是 gif 也输出 jpg：需注册 gif 解码器才能解码生成
	dir := t.TempDir()
	p := filepath.Join(dir, "789.gif")
	gifData, err := base64.StdEncoding.DecodeString(gifFixtureB64)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(p, gifData, 0644); err != nil {
		t.Fatal(err)
	}
	ok, err := EnsureThumbnail(p)
	if err != nil || !ok {
		t.Fatalf("gif = (%v, %v), want (true, nil)", ok, err)
	}
	f, err := os.Open(ThumbPath(p))
	if err != nil {
		t.Fatalf("缩略图未生成: %v", err)
	}
	defer f.Close()
	cfg, _, err := image.DecodeConfig(f)
	if err != nil {
		t.Fatalf("缩略图解码失败: %v", err)
	}
	if cfg.Width != 500 {
		t.Errorf("缩略图宽度 = %d, want 500", cfg.Width)
	}
}

// 供 Task 2 复用的辅助：返回 key 对应的本地文件路径
func keyToLocal(t *testing.T, s *LocalStorage, key string) string {
	t.Helper()
	return filepath.Join(s.BasePath, filepath.FromSlash(strings.TrimPrefix(key, s.urlPath)))
}

// nopCloser 包装 bytes.Reader 以满足 multipart.File 接口（bytes.Reader 无 Close）
type nopCloser struct{ *bytes.Reader }

func (nopCloser) Close() error { return nil }

func saveFile(t *testing.T, s *LocalStorage, name string, data []byte) string {
	t.Helper()
	key, err := s.Save(nopCloser{bytes.NewReader(data)}, &multipart.FileHeader{Filename: name})
	if err != nil {
		t.Fatal(err)
	}
	return key
}

func TestSaveGeneratesThumbnail(t *testing.T) {
	s, err := NewLocalStorage(t.TempDir(), "http://example.com")
	if err != nil {
		t.Fatal(err)
	}
	key := saveFile(t, s, "test.jpg", jpegBytes(t, 900, 700))
	local := keyToLocal(t, s, key)
	if _, err := os.Stat(ThumbPath(local)); err != nil {
		t.Fatalf("Save 未生成缩略图: %v", err)
	}
}

func TestSaveSmallImageNoThumbnail(t *testing.T) {
	s, err := NewLocalStorage(t.TempDir(), "http://example.com")
	if err != nil {
		t.Fatal(err)
	}
	key := saveFile(t, s, "test.jpg", jpegBytes(t, 400, 300))
	local := keyToLocal(t, s, key)
	if _, err := os.Stat(ThumbPath(local)); !os.IsNotExist(err) {
		t.Error("小图上传不应生成缩略图")
	}
}

func TestDeleteRemovesThumbnail(t *testing.T) {
	s, err := NewLocalStorage(t.TempDir(), "http://example.com")
	if err != nil {
		t.Fatal(err)
	}
	key := saveFile(t, s, "test.jpg", jpegBytes(t, 900, 700))
	local := keyToLocal(t, s, key)
	if _, err := os.Stat(ThumbPath(local)); err != nil {
		t.Fatal("前置条件：缩略图应已生成")
	}
	if err := s.Delete(key); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if _, err := os.Stat(local); !os.IsNotExist(err) {
		t.Error("原图未被删除")
	}
	if _, err := os.Stat(ThumbPath(local)); !os.IsNotExist(err) {
		t.Error("缩略图未被连带删除")
	}
}

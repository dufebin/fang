# 上传时生成缩略图 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 房源列表卡片图片改用上传时预生成的缩略图（宽 500px JPEG），详情页继续用原图。

**Architecture:** 后端 `LocalStorage.Save` 保存原图后调用 `EnsureThumbnail` 在同目录生成 `<stem>_thumb.jpg`；`Delete` 连带删除缩略图。新增 `cmd/gen-thumbnails` 为存量图片补生成。前端 `utils/format.js` 新增 `thumbURL()` 按命名规则推导缩略图 URL，`property-card` 组件的封面/四宫格都走 `thumbURL` 并以 `binderror` 回退原图。

**Tech Stack:** Go 标准库（`image`/`image/jpeg`，手写 box-filter 下采样，不引新依赖）、微信小程序原生组件。

**Spec:** `docs/superpowers/specs/2026-11-16-upload-thumbnails-design.md`

## Global Constraints

- 不引入任何新的 Go 依赖（缩放算法手写）。
- 缩略图规格：宽 500px 等比缩小，JPEG quality 75，命名 `<stem>_thumb.jpg`（源是 png/gif 也输出 jpg）。
- 跳过不生成：宽 ≤ 500px、webp（Go 标准库无法解码）。
- 缩略图生成失败只记日志，不影响原图保存和接口返回。
- API / DB 零改动；`PropertyImage.url` 字段不变。
- 详情页、H5、admin 不动，继续用原图。
- 提交信息用中文、按仓库现有风格（`feat(backend): ...` / `feat(miniprogram): ...`），结尾加 `Co-Authored-By: Claude Code <noreply@anthropic.com>`。
- 后端所有命令在 `/data/source/fang/backend` 下执行。

---

### Task 1: 后端缩略图核心函数 + 单测

**Files:**
- Modify: `backend/pkg/storage/storage.go`（文件末尾追加函数；`import` 增加 `"image/color"`）
- Test: `backend/pkg/storage/storage_test.go`（新建）

**Interfaces:**
- Consumes: 无（首个任务）
- Produces:
  - `func ThumbPath(path string) string` — 返回 `path` 对应缩略图绝对路径（同目录、`<stem>_thumb.jpg`）
  - `func EnsureThumbnail(path string) (bool, error)` — 缩略图缺失且原图宽 > 500px 时生成；返回是否写入。已存在/小图/webp/解码失败 → `(false, nil)`；读文件失败 → `(false, err)`
  - 内部：`thumbFilename(name string) string`、`thumbnailBytes(data []byte) ([]byte, bool)`、`downscale(img image.Image, targetW int) *image.RGBA`
  - 常量：`thumbMaxWidth = 500`、`thumbQuality = 75`

- [ ] **Step 1: 写失败的单测**

新建 `backend/pkg/storage/storage_test.go`：

```go
package storage

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
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

// 供 Task 2 复用的辅助：返回 key 对应的本地文件路径
func keyToLocal(t *testing.T, s *LocalStorage, key string) string {
	t.Helper()
	return filepath.Join(s.BasePath, filepath.FromSlash(strings.TrimPrefix(key, s.urlPath)))
}
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /data/source/fang/backend && go test ./pkg/storage/ -run 'Thumb|EnsureThumbnail' -v`
Expected: FAIL，编译错误 `undefined: ThumbPath` / `undefined: EnsureThumbnail`

- [ ] **Step 3: 实现核心函数**

在 `backend/pkg/storage/storage.go` 的 import 块加 `"image/color"`，文件末尾追加：

```go
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
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd /data/source/fang/backend && go test ./pkg/storage/ -run 'Thumb|EnsureThumbnail' -v`
Expected: 全部 PASS

- [ ] **Step 5: Commit**

```bash
cd /data/source/fang/backend && git add pkg/storage/storage.go pkg/storage/storage_test.go && git commit -m "feat(backend): 缩略图核心——EnsureThumbnail/box-filter 下采样

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: Save 集成生成 + Delete 连带删除

**Files:**
- Modify: `backend/pkg/storage/storage.go`（`Save` 写完原图后、`Delete` 删除原图后）
- Test: `backend/pkg/storage/storage_test.go`（追加）

**Interfaces:**
- Consumes: Task 1 的 `EnsureThumbnail(path string) (bool, error)`、`ThumbPath(path string) string`、`thumbFilename(name string) string`；测试辅助 `jpegBytes`、`keyToLocal`
- Produces: `LocalStorage.Save` 保存原图后自动生成缩略图（失败仅记日志）；`LocalStorage.Delete` 删除原图后连带删除缩略图（缩略图不存在时忽略）

- [ ] **Step 1: 追加失败的单测**

在 `backend/pkg/storage/storage_test.go` 末尾追加（`mime/multipart` 加入 import）：

```go
func saveFile(t *testing.T, s *LocalStorage, name string, data []byte) string {
	t.Helper()
	key, err := s.Save(bytes.NewReader(data), &multipart.FileHeader{Filename: name})
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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /data/source/fang/backend && go test ./pkg/storage/ -run 'Save|Delete' -v`
Expected: `TestSaveGeneratesThumbnail` FAIL（缩略图未生成）、`TestDeleteRemovesThumbnail` FAIL（缩略图残留）

- [ ] **Step 3: 修改 Save 与 Delete**

`storage.go` import 增加 `"log"`。

`Save` 中，在 `if _, err := out.Write(fileBytes); err != nil { ... }` 块之后、`// 返回可访问的 URL` 之前插入：

```go
	// 生成缩略图（纯优化，失败不影响原图保存）
	if _, err := EnsureThumbnail(dst); err != nil {
		log.Printf("生成缩略图失败 %s: %v", dst, err)
	}
```

`Delete` 将末行的 `return os.Remove(filepath.Join(s.BasePath, filepath.FromSlash(key)))` 改为：

```go
	if err := os.Remove(filepath.Join(s.BasePath, filepath.FromSlash(key))); err != nil {
		return err
	}
	// 连带删除缩略图（视频或缩略图不存在时忽略）
	_ = os.Remove(filepath.Join(s.BasePath, filepath.FromSlash(filepath.Dir(key)), thumbFilename(filepath.Base(key))))
	return nil
```

- [ ] **Step 4: 跑全部 storage 测试确认通过**

Run: `cd /data/source/fang/backend && go test ./pkg/storage/ -v`
Expected: 全部 PASS（含 Task 1 的测试）

- [ ] **Step 5: Commit**

```bash
cd /data/source/fang/backend && git add pkg/storage/storage.go pkg/storage/storage_test.go && git commit -m "feat(backend): 上传自动生成缩略图，删除连带清理

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: 存量迁移工具 cmd/gen-thumbnails

**Files:**
- Create: `backend/cmd/gen-thumbnails/main.go`

**Interfaces:**
- Consumes: Task 1 的 `storage.EnsureThumbnail(path string) (bool, error)`、`storage.ThumbPath(path string) string`；模块路径 `fangchan`（go.mod）
- Produces: 可执行命令 `go run ./cmd/gen-thumbnails/ [-uploads ./uploads] [-dry-run]`，幂等

- [ ] **Step 1: 实现 main.go**

```go
// gen-thumbnails walks the uploads directory and generates missing <stem>_thumb.jpg
// files for images wider than 500px. Idempotent; safe to re-run.
// Usage: go run ./cmd/gen-thumbnails/ [-uploads ./uploads] [-dry-run]
package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	"fangchan/pkg/storage"
)

func main() {
	uploadsDir := flag.String("uploads", "./uploads", "local uploads directory")
	dryRun := flag.Bool("dry-run", false, "preview without making changes")
	flag.Parse()

	generated, skipped, failed := 0, 0, 0
	err := filepath.WalkDir(*uploadsDir, func(path string, d os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if d.IsDir() {
			return nil
		}
		name := d.Name()
		if strings.HasSuffix(name, "_thumb.jpg") {
			return nil // 已是缩略图
		}
		switch strings.ToLower(filepath.Ext(name)) {
		case ".jpg", ".jpeg", ".png", ".gif":
		default:
			return nil // webp 无法解码；视频等其他文件不处理
		}
		if _, err := os.Stat(storage.ThumbPath(path)); err == nil {
			skipped++ // 已有缩略图
			return nil
		}
		if *dryRun {
			fmt.Println("[dry-run] 需生成:", path)
			return nil
		}
		ok, err := storage.EnsureThumbnail(path)
		if err != nil {
			log.Printf("失败 %s: %v", path, err)
			failed++
			return nil
		}
		if ok {
			generated++
		} else {
			skipped++ // 小图或无法解码
		}
		return nil
	})
	if err != nil {
		log.Fatalf("遍历失败: %v", err)
	}
	fmt.Printf("完成：生成 %d，跳过 %d，失败 %d\n", generated, skipped, failed)
}
```

- [ ] **Step 2: 编译检查**

Run: `cd /data/source/fang/backend && go build ./...`
Expected: 无错误

- [ ] **Step 3: 用 fixture 目录手动验证**

```bash
rm -rf /tmp/gen-thumb-fixture && mkdir -p /tmp/gen-thumb-fixture/2026/11
cat > /tmp/mkjpg.go <<'EOF'
package main

import ("image"; "image/color"; "image/jpeg"; "os")

func main() {
	img := image.NewRGBA(image.Rect(0, 0, 900, 700))
	for y := 0; y < 700; y++ {
		for x := 0; x < 900; x++ {
			img.Set(x, y, color.RGBA{R: 90, G: 140, B: 60, A: 255})
		}
	}
	f, err := os.Create("/tmp/gen-thumb-fixture/2026/11/test.jpg")
	if err != nil {
		panic(err)
	}
	defer f.Close()
	if err := jpeg.Encode(f, img, &jpeg.Options{Quality: 90}); err != nil {
		panic(err)
	}
}
EOF
cd /data/source/fang/backend && go run /tmp/mkjpg.go
```

验证三连（每步检查输出）：

```bash
cd /data/source/fang/backend
go run ./cmd/gen-thumbnails -uploads /tmp/gen-thumb-fixture -dry-run
# 期望: 打印 "[dry-run] 需生成: .../test.jpg"，且目录内没有新文件（ls 验证）

go run ./cmd/gen-thumbnails -uploads /tmp/gen-thumb-fixture
# 期望: "完成：生成 1，跳过 0，失败 0"
ls -la /tmp/gen-thumb-fixture/2026/11/
# 期望: 出现 test_thumb.jpg，体积明显小于 test.jpg

file /tmp/gen-thumb-fixture/2026/11/test_thumb.jpg
# 期望: JPEG，尺寸 500x388

go run ./cmd/gen-thumbnails -uploads /tmp/gen-thumb-fixture
# 期望: "完成：生成 0，跳过 1，失败 0"（幂等）
```

- [ ] **Step 4: 清理 fixture 并跑全量测试**

```bash
rm -rf /tmp/gen-thumb-fixture /tmp/mkjpg.go
cd /data/source/fang/backend && go test ./...
```

Expected: 全部 PASS

- [ ] **Step 5: Commit**

```bash
cd /data/source/fang/backend && git add cmd/gen-thumbnails && git commit -m "feat(backend): 存量图片缩略图迁移工具 gen-thumbnails

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: 前端 thumbURL 工具函数

**Files:**
- Modify: `frontend/miniprogram/utils/format.js`

**Interfaces:**
- Consumes: 同文件 `fullImageURL(url)`、`utils/config.js` 的 `UPLOAD_BASE`
- Produces: `thumbURL(url)` — 导出供 `property-card` 使用。规则：空 → `''`；`http` 开头 → 原样返回；相对路径 → `UPLOAD_BASE` + 把扩展名替换为 `_thumb` 后缀（`/uploads/a/b/123.jpg` → `<UPLOAD_BASE>/uploads/a/b/123_thumb.jpg`）

- [ ] **Step 1: 写失败的 node 断言**

Run:

```bash
cd /data/source/fang/frontend/miniprogram && node -e "
const { thumbURL } = require('./utils/format')
const assert = require('assert')
assert.strictEqual(thumbURL('/uploads/2026/11/123.jpg'), 'https://fapi.sanjiufangchan.cn/uploads/2026/11/123_thumb.jpg')
assert.strictEqual(thumbURL('/uploads/a.png'), 'https://fapi.sanjiufangchan.cn/uploads/a_thumb.jpg')
assert.strictEqual(thumbURL('https://cos.example.com/a.jpg'), 'https://cos.example.com/a.jpg')
assert.strictEqual(thumbURL(''), '')
console.log('thumbURL OK')
"
```

Expected: FAIL — `thumbURL is not a function`

- [ ] **Step 2: 实现**

在 `frontend/miniprogram/utils/format.js` 的 `fullImageURL` 函数之后追加：

```js
// 列表缩略图 URL（同目录 <stem>_thumb.jpg；遗留绝对 URL 无缩略图，回退原图）
function thumbURL(url) {
  if (!url) return ''
  if (url.startsWith('http')) return url
  return fullImageURL(url.replace(/(\.[^.]+)$/, '_thumb$1'))
}
```

并在文件末尾 `module.exports` 中 `fullImageURL,` 之后加一行 `thumbURL,`。

- [ ] **Step 3: 跑 node 断言确认通过**

Run: 同 Step 1 的命令
Expected: 输出 `thumbURL OK`

- [ ] **Step 4: Commit**

```bash
cd /data/source/fang && git add frontend/miniprogram/utils/format.js && git commit -m "feat(miniprogram): 新增 thumbURL 列表缩略图 URL 推导

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 5: property-card 改用缩略图 + binderror 回退

**Files:**
- Modify: `frontend/miniprogram/components/property-card/index.js`
- Modify: `frontend/miniprogram/components/property-card/index.wxml`

**Interfaces:**
- Consumes: Task 4 的 `thumbURL(url)`、既有 `fullImageURL(url)`
- Produces: 无对外新接口；组件属性不变（`property` / `fourImages` 等）

- [ ] **Step 1: 修改 index.js**

完整替换 `frontend/miniprogram/components/property-card/index.js` 为：

```js
const { fullImageURL, thumbURL } = require('../../utils/format')

Component({
  properties: {
    property: { type: Object, value: {} },
    agentCode: { type: String, value: '' },
    showStatus: { type: Boolean, value: false },
    compact: { type: Boolean, value: false },
    fourImages: { type: Boolean, value: false },
  },

  observers: {
    property(p) {
      const coverSrc = (p.images && p.images.length > 0)
        ? p.images[0].url
        : p.cover_image
      const quickTags = []
      if (p.video_url) quickTags.push('视频讲房')
      if (p.is_verified) quickTags.push('已核验')
      if (p.tags) {
        String(p.tags).split(',').map(s => s.trim()).filter(Boolean).slice(0, 2).forEach(tag => {
          if (quickTags.indexOf(tag) < 0) quickTags.push(tag)
        })
      }
      const imgs = p.images && p.images.length ? p.images : []
      const srcs = imgs.length >= 2
        ? [0, 1, 2, 3].map(i => imgs[Math.min(i, imgs.length - 1)].url)
        : []
      const fourImgUrls = srcs.map(thumbURL)
      // 缩略图加载失败时回退原图；两者相同（如遗留绝对 URL）则不设回退
      const fourOriginals = srcs.map(u => (thumbURL(u) === fullImageURL(u) ? '' : fullImageURL(u)))
      const coverImage = thumbURL(coverSrc)
      const coverFallback = coverImage === fullImageURL(coverSrc) ? '' : fullImageURL(coverSrc)
      this.setData({ coverImage, coverFallback, quickTags: quickTags.slice(0, 3), fourImgUrls, fourOriginals })
    },
  },

  methods: {
    onCoverImgError() {
      if (this.data.coverFallback) {
        this.setData({ coverImage: this.data.coverFallback, coverFallback: '' })
      }
    },
    onGridImgError(e) {
      const i = e.currentTarget.dataset.idx
      const fb = (this.data.fourOriginals || [])[i]
      if (fb) {
        this.setData({ [`fourImgUrls[${i}]`]: fb, [`fourOriginals[${i}]`]: '' })
      }
    },
    onTap() {
      const { id } = this.properties.property
      const agentCode = this.properties.agentCode
      wx.navigateTo({
        url: `/pages/property-detail/index?id=${id}${agentCode ? '&a=' + agentCode : ''}`,
      })
    },
  },

  data: {
    coverImage: '',
    coverFallback: '',
    quickTags: [],
    fourImgUrls: [],
    fourOriginals: [],
  },
})
```

- [ ] **Step 2: 修改 index.wxml**

`components/property-card/index.wxml` 中两个 `<image>` 标签加 `binderror`（四宫格的加 `data-idx`）：

四宫格（第 7-14 行）改为：

```xml
      <image
        wx:for="{{fourImgUrls}}"
        wx:key="index"
        class="card-grid-img"
        src="{{item}}"
        mode="aspectFill"
        lazy-load
        binderror="onGridImgError"
        data-idx="{{index}}"
      />
```

单图（第 17-23 行）改为：

```xml
    <image
      wx:else
      class="card-image"
      src="{{coverImage}}"
      mode="aspectFill"
      lazy-load
      binderror="onCoverImgError"
    />
```

其余内容（状态标签、卡片主体等）不动。

- [ ] **Step 3: 语法检查 + 全局影响确认**

```bash
cd /data/source/fang/frontend/miniprogram
node --check components/property-card/index.js
grep -rn "coverImage\|fourImgUrls" components/property-card/ pages/ utils/ --include=*.js --include=*.wxml | grep -v "components/property-card/index"
```

Expected: 语法检查无输出（通过）；grep 无其他文件引用这两个 data 字段（确认改动不外溢）

- [ ] **Step 4: 人工核对**

通读改后的 `index.js` 和 `index.wxml`，逐项确认：
- 四宫格与单图封面都走 `thumbURL`
- `binderror` 回退只触发一次（回退后 fallback 置空）
- 未触碰 `onTap`、状态标签、`compact` 模式逻辑

- [ ] **Step 5: Commit**

```bash
cd /data/source/fang && git add frontend/miniprogram/components/property-card/ && git commit -m "feat(miniprogram): 房源卡片改用缩略图，加载失败回退原图

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## 部署（代码完成后、经用户确认再执行）

1. `./deploy-backend.sh` — 构建并部署后端（脚本会 rsync 本地 uploads，属既有行为）
2. 生产服务器执行一次：`cd /www/wwwroot/admin && ./gen-thumbnails`（需先把 gen-thumbnails 二进制传上去：本地 `cd backend && go build -o bin/gen-thumbnails ./cmd/gen-thumbnails/` 后 `rsync -avz bin/gen-thumbnails root@111.229.9.22:/www/wwwroot/admin/`；建议先带 `-dry-run` 预览）
3. 小程序发版：用户在微信开发者工具上传（代码就绪后由用户操作）
4. 验证：小程序首页/列表页图片正常显示且 URL 带 `_thumb.jpg`；点进详情页仍为原图

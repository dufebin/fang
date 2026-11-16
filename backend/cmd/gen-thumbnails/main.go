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

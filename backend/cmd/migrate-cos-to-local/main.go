// migrate-cos-to-local downloads all COS image/video URLs from DB to the local uploads directory
// and updates DB records to local paths.
// Run once after switching storage.type to "local".
// Usage: go run ./cmd/migrate-cos-to-local/ [-config configs/config.yaml] [-uploads ./uploads] [-dry-run]
package main

import (
	"database/sql"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "github.com/go-sql-driver/mysql"
	"gopkg.in/yaml.v3"
)

type config struct {
	Database struct {
		Host     string `yaml:"host"`
		Port     int    `yaml:"port"`
		User     string `yaml:"user"`
		Password string `yaml:"password"`
		Name     string `yaml:"name"`
	} `yaml:"database"`
	Storage struct {
		COS struct {
			Bucket string `yaml:"bucket"`
			Region string `yaml:"region"`
		} `yaml:"cos"`
	} `yaml:"storage"`
}

func main() {
	cfgPath := flag.String("config", "configs/config.yaml", "config file")
	uploadsDir := flag.String("uploads", "./uploads", "local uploads directory")
	dryRun := flag.Bool("dry-run", false, "preview without making changes")
	flag.Parse()

	raw, err := os.ReadFile(*cfgPath)
	if err != nil {
		log.Fatalf("read config: %v", err)
	}
	var cfg config
	if err := yaml.Unmarshal(raw, &cfg); err != nil {
		log.Fatalf("parse config: %v", err)
	}

	cosBase := fmt.Sprintf("https://%s.cos.%s.myqcloud.com", cfg.Storage.COS.Bucket, cfg.Storage.COS.Region)

	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True",
		cfg.Database.User, cfg.Database.Password, cfg.Database.Host, cfg.Database.Port, cfg.Database.Name)
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	defer db.Close()

	type column struct{ table, col, id string }
	columns := []column{
		{"properties", "cover_image", "id"},
		{"properties", "video_url", "id"},
		{"property_images", "url", "id"},
		{"articles", "cover_image", "id"},
		{"banners", "image_url", "id"},
	}

	total, migrated, skipped, failed := 0, 0, 0, 0

	for _, c := range columns {
		q := fmt.Sprintf("SELECT %s, %s FROM %s WHERE %s IS NOT NULL AND %s != ''", c.id, c.col, c.table, c.col, c.col)
		rows, err := db.Query(q)
		if err != nil {
			log.Printf("query %s.%s: %v", c.table, c.col, err)
			continue
		}
		type rec struct {
			id  int64
			val string
		}
		var recs []rec
		for rows.Next() {
			var r rec
			rows.Scan(&r.id, &r.val)
			recs = append(recs, r)
		}
		rows.Close()

		for _, r := range recs {
			total++
			if !strings.HasPrefix(r.val, cosBase) {
				skipped++
				continue
			}

			// strip cosBase prefix to get the object key, e.g. "uploads/2026/01/xxx.jpg"
			key := strings.TrimPrefix(r.val, cosBase+"/")
			localPath := "/" + key // stored in DB as "/uploads/年/月/文件名"

			if *dryRun {
				log.Printf("DRY  [%s] id=%d  %s  →  %s", c.table, r.id, r.val, localPath)
				migrated++
				continue
			}

			if err := download(r.val, key, *uploadsDir); err != nil {
				log.Printf("FAIL [%s] id=%d %s: %v", c.table, r.id, r.val, err)
				failed++
				continue
			}

			if _, dbErr := db.Exec(
				fmt.Sprintf("UPDATE %s SET %s=? WHERE %s=?", c.table, c.col, c.id),
				localPath, r.id,
			); dbErr != nil {
				log.Printf("FAIL db update %s id=%d: %v", c.table, r.id, dbErr)
				failed++
				continue
			}

			migrated++
			log.Printf("OK   [%s] id=%d  %s  →  %s", c.table, r.id, r.val, localPath)
		}
	}
	fmt.Printf("\ndone: total=%d  migrated=%d  skipped(not COS)=%d  failed=%d\n", total, migrated, skipped, failed)
}

// download fetches cosURL and saves it under uploadsDir/key, creating dirs as needed.
func download(cosURL, key, uploadsDir string) error {
	client := &http.Client{Timeout: 2 * time.Minute}
	resp, err := client.Get(cosURL)
	if err != nil {
		return fmt.Errorf("http get: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		io.Copy(io.Discard, resp.Body)
		return fmt.Errorf("http status %d", resp.StatusCode)
	}

	dst := filepath.Join(uploadsDir, filepath.FromSlash(key))
	if err := os.MkdirAll(filepath.Dir(dst), 0755); err != nil {
		return fmt.Errorf("mkdir: %w", err)
	}

	f, err := os.Create(dst)
	if err != nil {
		return fmt.Errorf("create file: %w", err)
	}
	defer f.Close()

	if _, err := io.Copy(f, resp.Body); err != nil {
		return fmt.Errorf("write: %w", err)
	}
	return nil
}

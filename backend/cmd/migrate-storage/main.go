// migrate-storage uploads all local file paths in the DB to COS and updates the records.
// Run once after switching storage.type to "cos".
// Usage: go run ./cmd/migrate-storage/ [-config configs/config.yaml] [-server https://fapi.deephealth.net] [-dry-run]
package main

import (
	"context"
	"database/sql"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	_ "github.com/go-sql-driver/mysql"
	cos "github.com/tencentyun/cos-go-sdk-v5"
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
			SecretID  string `yaml:"secret_id"`
			SecretKey string `yaml:"secret_key"`
			Bucket    string `yaml:"bucket"`
			Region    string `yaml:"region"`
		} `yaml:"cos"`
	} `yaml:"storage"`
}

func main() {
	cfgPath := flag.String("config", "configs/config.yaml", "config file")
	serverBase := flag.String("server", "https://fapi.deephealth.net", "server base URL to download existing local files; also migrates full URLs on this host")
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

	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True",
		cfg.Database.User, cfg.Database.Password, cfg.Database.Host, cfg.Database.Port, cfg.Database.Name)
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	defer db.Close()

	cosBase := fmt.Sprintf("https://%s.cos.%s.myqcloud.com", cfg.Storage.COS.Bucket, cfg.Storage.COS.Region)
	bu, _ := url.Parse(cosBase)
	cosClient := cos.NewClient(&cos.BaseURL{BucketURL: bu}, &http.Client{
		Transport: &cos.AuthorizationTransport{
			SecretID:  cfg.Storage.COS.SecretID,
			SecretKey: cfg.Storage.COS.SecretKey,
		},
	})

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
			// skip if already on COS
			if strings.HasPrefix(r.val, cosBase) {
				skipped++
				continue
			}
			// also skip unrelated external URLs
			if (strings.HasPrefix(r.val, "http://") || strings.HasPrefix(r.val, "https://")) &&
				!strings.HasPrefix(r.val, *serverBase) {
				skipped++
				continue
			}
			newURL, uploadErr := upload(r.val, *serverBase, cosBase, cosClient, *dryRun)
			if uploadErr != nil {
				log.Printf("FAIL %s.%s id=%d %s: %v", c.table, c.col, r.id, r.val, uploadErr)
				failed++
				continue
			}
			if !*dryRun {
				if _, dbErr := db.Exec(
					fmt.Sprintf("UPDATE %s SET %s=? WHERE %s=?", c.table, c.col, c.id),
					newURL, r.id,
				); dbErr != nil {
					log.Printf("FAIL db update %s id=%d: %v", c.table, r.id, dbErr)
					failed++
					continue
				}
			}
			migrated++
			log.Printf("OK   [%s] id=%d  %s  →  %s", c.table, r.id, r.val, newURL)
		}
	}
	fmt.Printf("\ndone: total=%d  migrated=%d  skipped(already COS)=%d  failed=%d\n", total, migrated, skipped, failed)
}

func upload(localPath, serverBase, cosBase string, client *cos.Client, dryRun bool) (string, error) {
	// normalize to a relative key regardless of whether localPath is a
	// relative path (/uploads/...) or a full server URL (https://server/uploads/...)
	var key string
	if strings.HasPrefix(localPath, serverBase) {
		key = strings.TrimPrefix(localPath, strings.TrimRight(serverBase, "/")+"/")
	} else {
		key = strings.TrimPrefix(localPath, "/")
	}
	newURL := cosBase + "/" + key
	if dryRun {
		return newURL, nil
	}
	downloadURL := strings.TrimRight(serverBase, "/") + "/" + key
	resp, err := http.Get(downloadURL)
	if err != nil {
		return "", fmt.Errorf("download: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		io.Copy(io.Discard, resp.Body)
		return "", fmt.Errorf("download status %d", resp.StatusCode)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	_, err = client.Object.Put(ctx, key, resp.Body, &cos.ObjectPutOptions{
		ObjectPutHeaderOptions: &cos.ObjectPutHeaderOptions{
			ContentType: resp.Header.Get("Content-Type"),
		},
	})
	if err != nil {
		return "", fmt.Errorf("cos put: %w", err)
	}
	return newURL, nil
}

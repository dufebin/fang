package storage

import (
	"context"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/url"
	"path/filepath"
	"strings"
	"time"

	cos "github.com/tencentyun/cos-go-sdk-v5"
)

type COSStorage struct {
	client  *cos.Client
	baseURL string
}

func NewCOSStorage(secretID, secretKey, bucket, region, baseURL string) (*COSStorage, error) {
	bucketURL := fmt.Sprintf("https://%s.cos.%s.myqcloud.com", bucket, region)
	u, err := url.Parse(bucketURL)
	if err != nil {
		return nil, fmt.Errorf("parse cos url: %w", err)
	}
	client := cos.NewClient(
		&cos.BaseURL{BucketURL: u},
		&http.Client{
			Transport: &cos.AuthorizationTransport{
				SecretID:  secretID,
				SecretKey: secretKey,
			},
		},
	)
	if baseURL == "" {
		baseURL = bucketURL
	}
	return &COSStorage{client: client, baseURL: baseURL}, nil
}

func (s *COSStorage) Save(file multipart.File, header *multipart.FileHeader) (string, error) {
	ext := strings.ToLower(filepath.Ext(header.Filename))
	if !isAllowedImageExt(ext) {
		return "", fmt.Errorf("不支持的文件类型: %s", ext)
	}
	key := fmt.Sprintf("uploads/%s/%d%s", time.Now().Format("2006/01"), time.Now().UnixNano(), ext)
	if _, err := s.client.Object.Put(context.Background(), key, file, &cos.ObjectPutOptions{
		ACLHeaderOptions: &cos.ACLHeaderOptions{XCosACL: "public-read"},
	}); err != nil {
		return "", fmt.Errorf("cos upload: %w", err)
	}
	return s.baseURL + "/" + key, nil
}

func (s *COSStorage) SaveVideo(file multipart.File, header *multipart.FileHeader) (string, error) {
	ext := strings.ToLower(filepath.Ext(header.Filename))
	if !isAllowedVideoExt(ext) {
		return "", fmt.Errorf("不支持的视频类型: %s", ext)
	}
	key := fmt.Sprintf("uploads/%s/%d%s", time.Now().Format("2006/01"), time.Now().UnixNano(), ext)
	if _, err := s.client.Object.Put(context.Background(), key, file, &cos.ObjectPutOptions{
		ACLHeaderOptions: &cos.ACLHeaderOptions{XCosACL: "public-read"},
	}); err != nil {
		return "", fmt.Errorf("cos upload video: %w", err)
	}
	return s.baseURL + "/" + key, nil
}

func (s *COSStorage) URL(key string) string {
	if strings.HasPrefix(key, "http://") || strings.HasPrefix(key, "https://") {
		return key
	}
	return s.baseURL + "/" + strings.TrimPrefix(key, "/")
}

func (s *COSStorage) Delete(key string) error {
	// accept both a stored key and a full COS URL
	key = strings.TrimPrefix(key, s.baseURL+"/")
	key = strings.TrimPrefix(key, "/")
	if key == "" {
		return nil
	}
	_, err := s.client.Object.Delete(context.Background(), key)
	return err
}

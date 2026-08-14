package pintdown

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type Client struct {
	BaseURL   string
	APIToken  string
	HTTP      *http.Client
	MaxRetry  int
}

func NewClient(baseURL, apiToken string) *Client {
	return &Client{
		BaseURL:  baseURL,
		APIToken: apiToken,
		HTTP:     &http.Client{Timeout: 30 * time.Second},
		MaxRetry: 3,
	}
}

type BacklinkPage struct {
	Items []map[string]any `json:"items"`
	Total int              `json:"total"`
}

func (c *Client) ListBacklinks(page, pageSize int) (*BacklinkPage, error) {
	url := fmt.Sprintf("%s/api/v1/backlinks?page=%d&page_size=%d", c.BaseURL, page, pageSize)
	var lastErr error
	for attempt := 0; attempt <= c.MaxRetry; attempt++ {
		req, err := http.NewRequest(http.MethodGet, url, nil)
		if err != nil {
			return nil, err
		}
		req.Header.Set("Authorization", "Bearer "+c.APIToken)
		res, err := c.HTTP.Do(req)
		if err != nil {
			lastErr = err
			time.Sleep(time.Duration(200*(1<<attempt)) * time.Millisecond)
			continue
		}
		body, _ := io.ReadAll(res.Body)
		res.Body.Close()
		if res.StatusCode >= 200 && res.StatusCode < 300 {
			var out BacklinkPage
			if err := json.Unmarshal(body, &out); err != nil {
				return nil, err
			}
			return &out, nil
		}
		if res.StatusCode == 429 || res.StatusCode >= 500 {
			lastErr = fmt.Errorf("status %d: %s", res.StatusCode, string(body))
			time.Sleep(time.Duration(200*(1<<attempt)) * time.Millisecond)
			continue
		}
		return nil, fmt.Errorf("status %d: %s", res.StatusCode, string(body))
	}
	return nil, lastErr
}

package tests

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"
	"testing"

	"auto-clipper/internal/pipeline"
)

// clientFor builds a WorkerClient pointed at the given httptest server by parsing
// its host/port back into NewWorkerClient (which composes http://host:port).
func clientFor(t *testing.T, srv *httptest.Server) *pipeline.WorkerClient {
	t.Helper()
	u, err := url.Parse(srv.URL)
	if err != nil {
		t.Fatalf("bad test server url: %v", err)
	}
	port, err := strconv.Atoi(u.Port())
	if err != nil {
		t.Fatalf("bad port: %v", err)
	}
	return pipeline.NewWorkerClient(u.Hostname(), port)
}

func TestWorkerClientHealth(t *testing.T) {
	cases := []struct {
		name    string
		status  int
		wantErr bool
	}{
		{name: "200 ok", status: http.StatusOK, wantErr: false},
		// Health only checks transport, not status code, so 500 is still nil-err.
		{name: "500 still no transport error", status: http.StatusInternalServerError, wantErr: false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path != "/health" {
					t.Errorf("unexpected path %q", r.URL.Path)
				}
				w.WriteHeader(tc.status)
			}))
			defer srv.Close()

			err := clientFor(t, srv).Health(context.Background())
			if (err != nil) != tc.wantErr {
				t.Errorf("Health err = %v, wantErr = %v", err, tc.wantErr)
			}
		})
	}
}

func TestWorkerClientFetchMetadata(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/metadata" {
			t.Errorf("got %s %s, want POST /metadata", r.Method, r.URL.Path)
		}
		if ct := r.Header.Get("Content-Type"); ct != "application/json" {
			t.Errorf("Content-Type = %q, want application/json", ct)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"title":"Video A","channel":"Chan","duration":612,"views":42,"video_id":"vid123"}`))
	}))
	defer srv.Close()

	resp, err := clientFor(t, srv).FetchMetadata(context.Background(), pipeline.MetadataRequest{URL: "http://x"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Title != "Video A" {
		t.Errorf("Title = %q, want %q", resp.Title, "Video A")
	}
	if resp.Duration != 612 {
		t.Errorf("Duration = %d, want 612", resp.Duration)
	}
	if resp.VideoID != "vid123" {
		t.Errorf("VideoID = %q, want vid123", resp.VideoID)
	}
}

// A >=400 response must surface as an error carrying the status and body.
func TestWorkerClientPostError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
		w.Write([]byte("upstream boom"))
	}))
	defer srv.Close()

	_, err := clientFor(t, srv).FetchMetadata(context.Background(), pipeline.MetadataRequest{URL: "http://x"})
	if err == nil {
		t.Fatal("expected error for 502 response, got nil")
	}
	if !strings.Contains(err.Error(), "502") || !strings.Contains(err.Error(), "upstream boom") {
		t.Errorf("error %q should mention status and body", err.Error())
	}
}

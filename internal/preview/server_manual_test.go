//go:build cgo

package preview

import (
	"net/http/httptest"
	"net/url"
	"os"
	"testing"
)

func TestFrameHandler(t *testing.T) {
	path := "/Users/user/.autoclipper/videos/XCRNBsehrRs.mp4"
	if _, err := os.Stat(path); err != nil {
		t.Skip("video tidak ada")
	}
	pool := NewPool(2)
	defer pool.CloseAll()
	h := pool.FrameHandler()

	req := httptest.NewRequest("GET", "/preview/frame?"+url.Values{
		"path": {path}, "t": {"124.0"}, "q": {"80"},
	}.Encode(), nil)
	rec := httptest.NewRecorder()
	h(rec, req)

	if rec.Code != 200 {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	t.Logf("JPEG %d bytes, dims %sx%s, ct=%s",
		rec.Body.Len(), rec.Header().Get("X-Frame-Width"),
		rec.Header().Get("X-Frame-Height"), rec.Header().Get("Content-Type"))
	if rec.Body.Len() < 1000 {
		t.Errorf("JPEG terlalu kecil: %d bytes", rec.Body.Len())
	}
	// second request same path → harus pakai cached decoder (tidak error)
	rec2 := httptest.NewRecorder()
	h(rec2, httptest.NewRequest("GET", "/preview/frame?"+url.Values{"path": {path}, "t": {"10"}}.Encode(), nil))
	if rec2.Code != 200 {
		t.Fatalf("cached req status %d", rec2.Code)
	}
}

//go:build cgo

package preview

import (
	"os"
	"testing"
)

func TestDecodeRealVideo(t *testing.T) {
	path := "/Users/user/.autoclipper/videos/XCRNBsehrRs.mp4"
	if _, err := os.Stat(path); err != nil {
		t.Skip("video tidak ada")
	}
	d, err := Open(path)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	defer d.Close()
	w, h := d.Dimensions()
	t.Logf("dims: %dx%d", w, h)

	for _, ts := range []float64{0, 10.5, 124.0} {
		f, err := d.FrameAt(ts)
		if err != nil {
			t.Errorf("t=%.1f: %v", ts, err)
			continue
		}
		nonzero := 0
		for i := 0; i < len(f.Pix); i += 4 {
			if f.Pix[i] > 0 || f.Pix[i+1] > 0 || f.Pix[i+2] > 0 {
				nonzero++
			}
		}
		t.Logf("t=%.1f: %dx%d, %d bytes, %d/%d non-black px", ts, f.Width, f.Height, len(f.Pix), nonzero, f.Width*f.Height)
		if nonzero == 0 {
			t.Errorf("t=%.1f: frame seluruhnya hitam (decode gagal?)", ts)
		}
	}
}

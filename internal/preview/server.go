//go:build cgo

package preview

import (
	"bytes"
	"container/list"
	"fmt"
	"image"
	"image/jpeg"
	"net/http"
	"strconv"
	"sync"
)

// Pool menyimpan Decoder yang sudah terbuka per-path agar tidak membuka ulang
// file video tiap permintaan frame (mahal). LRU sederhana dengan kapasitas kecil.
type Pool struct {
	mu       sync.Mutex
	cap      int
	items    map[string]*list.Element
	order    *list.List // front = paling baru dipakai
}

type poolEntry struct {
	path string
	dec  *Decoder
}

func NewPool(capacity int) *Pool {
	if capacity < 1 {
		capacity = 4
	}
	return &Pool{
		cap:   capacity,
		items: make(map[string]*list.Element),
		order: list.New(),
	}
}

// get mengembalikan Decoder untuk path, membuka baru jika perlu.
func (p *Pool) get(path string) (*Decoder, error) {
	p.mu.Lock()
	defer p.mu.Unlock()

	if el, ok := p.items[path]; ok {
		p.order.MoveToFront(el)
		return el.Value.(*poolEntry).dec, nil
	}

	dec, err := Open(path)
	if err != nil {
		return nil, err
	}

	el := p.order.PushFront(&poolEntry{path: path, dec: dec})
	p.items[path] = el

	// Evict LRU jika melebihi kapasitas.
	for p.order.Len() > p.cap {
		back := p.order.Back()
		if back == nil {
			break
		}
		entry := back.Value.(*poolEntry)
		entry.dec.Close()
		delete(p.items, entry.path)
		p.order.Remove(back)
	}

	return dec, nil
}

// CloseAll menutup semua decoder (panggil saat shutdown).
func (p *Pool) CloseAll() {
	p.mu.Lock()
	defer p.mu.Unlock()
	for _, el := range p.items {
		el.Value.(*poolEntry).dec.Close()
	}
	p.items = make(map[string]*list.Element)
	p.order.Init()
}

// FrameHandler melayani GET /preview/frame?path=<abs>&t=<sec>[&q=<1-100>]
// dan mengembalikan frame JPEG. Dimensi asli dikirim via header.
//
// Frontend WebGL mengambil frame ini sebagai texture lalu melakukan
// transform crop/scale/pan di shader — decode native, transform GPU.
func (p *Pool) FrameHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Query().Get("path")
		if path == "" {
			http.Error(w, "path wajib", http.StatusBadRequest)
			return
		}
		tSec, err := strconv.ParseFloat(r.URL.Query().Get("t"), 64)
		if err != nil {
			http.Error(w, "t (detik) tidak valid", http.StatusBadRequest)
			return
		}
		quality := 80
		if q := r.URL.Query().Get("q"); q != "" {
			if v, err := strconv.Atoi(q); err == nil && v >= 1 && v <= 100 {
				quality = v
			}
		}

		dec, err := p.get(path)
		if err != nil {
			http.Error(w, fmt.Sprintf("open: %v", err), http.StatusInternalServerError)
			return
		}

		frame, err := dec.FrameAt(tSec)
		if err != nil {
			http.Error(w, fmt.Sprintf("decode: %v", err), http.StatusInternalServerError)
			return
		}

		img := &image.RGBA{
			Pix:    frame.Pix,
			Stride: frame.Width * 4,
			Rect:   image.Rect(0, 0, frame.Width, frame.Height),
		}
		var buf bytes.Buffer
		if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: quality}); err != nil {
			http.Error(w, fmt.Sprintf("encode: %v", err), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "image/jpeg")
		w.Header().Set("X-Frame-Width", strconv.Itoa(frame.Width))
		w.Header().Set("X-Frame-Height", strconv.Itoa(frame.Height))
		w.Header().Set("Cache-Control", "no-store")
		w.Write(buf.Bytes())
	}
}

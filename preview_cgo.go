//go:build cgo

package main

import (
	"net/http"

	"auto-clipper/internal/preview"
)

// previewPool di-share lintas request untuk caching decoder.
var previewPool = preview.NewPool(4)

// previewFrameHandler mengembalikan handler decode-frame native (libav).
func previewFrameHandler() http.HandlerFunc {
	return previewPool.FrameHandler()
}

func previewShutdown() {
	previewPool.CloseAll()
}

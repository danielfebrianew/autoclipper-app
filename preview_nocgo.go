//go:build !cgo

package main

import "net/http"

// Tanpa cgo, decoder native libav tidak tersedia. Endpoint mengembalikan 501
// dan frontend jatuh kembali ke crop CSS biasa.
func previewFrameHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "native preview butuh build cgo", http.StatusNotImplemented)
	}
}

func previewShutdown() {}

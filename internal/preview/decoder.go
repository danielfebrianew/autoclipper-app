//go:build cgo

// Package preview menyediakan decoder video native (libav via CGo) untuk
// kebutuhan preview real-time: buka video sekali, seek ke timestamp, decode
// satu frame menjadi RGBA. Frame mentah dikirim ke webview yang melakukan
// transform crop/scale/pan di WebGL — meniru pipeline CapCut/Premiere
// (decode native → transform GPU), dipetakan ke arsitektur Wails.
package preview

/*
#cgo pkg-config: libavcodec libavformat libavutil libswscale
#include <libavcodec/avcodec.h>
#include <libavformat/avformat.h>
#include <libavutil/imgutils.h>
#include <libswscale/swscale.h>
#include <stdlib.h>

// Helper: akses array C dari Go tanpa pointer arithmetic ribet.
static uint8_t* data_ptr(AVFrame* f, int i) { return f->data[i]; }
static int      linesize(AVFrame* f, int i) { return f->linesize[i]; }
*/
import "C"

import (
	"fmt"
	"sync"
	"unsafe"
)

// Decoder membungkus satu file video yang terbuka. Aman dipanggil dari banyak
// goroutine lewat mutex — libav context tidak thread-safe.
type Decoder struct {
	mu sync.Mutex

	path       string
	fmtCtx     *C.AVFormatContext
	codecCtx   *C.AVCodecContext
	swsCtx     *C.struct_SwsContext
	frame      *C.AVFrame // frame hasil decode (format asli, mis. YUV420)
	rgbFrame   *C.AVFrame // frame hasil konversi RGBA
	packet     *C.AVPacket
	streamIdx  C.int
	timeBase   C.AVRational
	width      int
	height     int
	rgbBufSize C.int
	rgbBuf     unsafe.Pointer
	closed     bool
}

// Frame adalah hasil decode: piksel RGBA + dimensi.
type Frame struct {
	Width  int
	Height int
	Pix    []byte // RGBA, len = Width*Height*4
}

// Open membuka file video dan menyiapkan decoder. Panggil Close saat selesai.
func Open(path string) (*Decoder, error) {
	cPath := C.CString(path)
	defer C.free(unsafe.Pointer(cPath))

	var fmtCtx *C.AVFormatContext
	if ret := C.avformat_open_input(&fmtCtx, cPath, nil, nil); ret < 0 {
		return nil, fmt.Errorf("avformat_open_input(%s): %s", path, avErr(ret))
	}

	if ret := C.avformat_find_stream_info(fmtCtx, nil); ret < 0 {
		C.avformat_close_input(&fmtCtx)
		return nil, fmt.Errorf("avformat_find_stream_info: %s", avErr(ret))
	}

	// Cari video stream + decoder terbaik.
	var decoder *C.AVCodec
	streamIdx := C.av_find_best_stream(fmtCtx, C.AVMEDIA_TYPE_VIDEO, -1, -1, &decoder, 0)
	if streamIdx < 0 {
		C.avformat_close_input(&fmtCtx)
		return nil, fmt.Errorf("tidak ada video stream")
	}

	streams := unsafe.Slice(fmtCtx.streams, fmtCtx.nb_streams)
	stream := streams[streamIdx]

	codecCtx := C.avcodec_alloc_context3(decoder)
	if codecCtx == nil {
		C.avformat_close_input(&fmtCtx)
		return nil, fmt.Errorf("avcodec_alloc_context3 gagal")
	}

	if ret := C.avcodec_parameters_to_context(codecCtx, stream.codecpar); ret < 0 {
		C.avcodec_free_context(&codecCtx)
		C.avformat_close_input(&fmtCtx)
		return nil, fmt.Errorf("avcodec_parameters_to_context: %s", avErr(ret))
	}

	// Multi-thread decode supaya seek+decode cepat.
	codecCtx.thread_count = 0 // 0 = auto

	if ret := C.avcodec_open2(codecCtx, decoder, nil); ret < 0 {
		C.avcodec_free_context(&codecCtx)
		C.avformat_close_input(&fmtCtx)
		return nil, fmt.Errorf("avcodec_open2: %s", avErr(ret))
	}

	w := int(codecCtx.width)
	h := int(codecCtx.height)

	d := &Decoder{
		path:      path,
		fmtCtx:    fmtCtx,
		codecCtx:  codecCtx,
		streamIdx: streamIdx,
		timeBase:  stream.time_base,
		width:     w,
		height:    h,
		frame:     C.av_frame_alloc(),
		rgbFrame:  C.av_frame_alloc(),
		packet:    C.av_packet_alloc(),
	}

	// Buffer RGBA + swscale context (YUV/apa pun → RGBA).
	d.rgbBufSize = C.av_image_get_buffer_size(C.AV_PIX_FMT_RGBA, C.int(w), C.int(h), 1)
	d.rgbBuf = C.av_malloc(C.size_t(d.rgbBufSize))
	C.av_image_fill_arrays(
		&d.rgbFrame.data[0], &d.rgbFrame.linesize[0],
		(*C.uint8_t)(d.rgbBuf), C.AV_PIX_FMT_RGBA, C.int(w), C.int(h), 1,
	)

	d.swsCtx = C.sws_getContext(
		C.int(w), C.int(h), int32(codecCtx.pix_fmt),
		C.int(w), C.int(h), C.AV_PIX_FMT_RGBA,
		C.SWS_BILINEAR, nil, nil, nil,
	)
	if d.swsCtx == nil {
		d.Close()
		return nil, fmt.Errorf("sws_getContext gagal")
	}

	return d, nil
}

// Dimensions mengembalikan ukuran asli video.
func (d *Decoder) Dimensions() (int, int) {
	return d.width, d.height
}

// FrameAt seek ke detik tSec dan mengembalikan frame terdekat sebagai RGBA.
func (d *Decoder) FrameAt(tSec float64) (*Frame, error) {
	d.mu.Lock()
	defer d.mu.Unlock()

	if d.closed {
		return nil, fmt.Errorf("decoder sudah ditutup")
	}

	// Konversi detik → timestamp dalam time_base stream.
	tb := float64(d.timeBase.num) / float64(d.timeBase.den)
	target := C.int64_t(tSec / tb)

	// Seek ke keyframe sebelum target, lalu decode maju sampai >= target.
	if ret := C.av_seek_frame(d.fmtCtx, d.streamIdx, target, C.AVSEEK_FLAG_BACKWARD); ret < 0 {
		return nil, fmt.Errorf("av_seek_frame: %s", avErr(ret))
	}
	C.avcodec_flush_buffers(d.codecCtx)

	for {
		C.av_packet_unref(d.packet)
		if ret := C.av_read_frame(d.fmtCtx, d.packet); ret < 0 {
			// EOF — coba ambil frame yang masih ter-buffer.
			break
		}
		if d.packet.stream_index != d.streamIdx {
			continue
		}

		if ret := C.avcodec_send_packet(d.codecCtx, d.packet); ret < 0 {
			continue
		}

		for {
			ret := C.avcodec_receive_frame(d.codecCtx, d.frame)
			if ret == -C.EAGAIN || ret == C.AVERROR_EOF {
				break
			}
			if ret < 0 {
				return nil, fmt.Errorf("avcodec_receive_frame: %s", avErr(ret))
			}

			// Sudah mencapai/melewati target? Konversi & kembalikan.
			if d.frame.pts >= target || d.frame.pts == C.AV_NOPTS_VALUE {
				return d.convertRGBA(), nil
			}
			// Belum sampai target, lanjut decode frame berikutnya.
		}
	}

	// Fallback: drain decoder.
	C.avcodec_send_packet(d.codecCtx, nil)
	if ret := C.avcodec_receive_frame(d.codecCtx, d.frame); ret == 0 {
		return d.convertRGBA(), nil
	}

	return nil, fmt.Errorf("tidak ada frame pada t=%.3fs", tSec)
}

// convertRGBA mengubah d.frame (format asli) → RGBA dan menyalin ke Go slice.
// Harus dipanggil dengan d.mu sudah ter-lock.
func (d *Decoder) convertRGBA() *Frame {
	C.sws_scale(
		d.swsCtx,
		&d.frame.data[0], &d.frame.linesize[0],
		0, C.int(d.height),
		&d.rgbFrame.data[0], &d.rgbFrame.linesize[0],
	)

	// rgbFrame mungkin punya stride (linesize) > width*4 karena alignment.
	// Salin baris-per-baris ke buffer rapat (tight) untuk webview.
	stride := int(C.linesize(d.rgbFrame, 0))
	rowBytes := d.width * 4
	pix := make([]byte, d.width*d.height*4)
	src := unsafe.Pointer(C.data_ptr(d.rgbFrame, 0))
	srcSlice := unsafe.Slice((*byte)(src), stride*d.height)
	for y := 0; y < d.height; y++ {
		copy(pix[y*rowBytes:(y+1)*rowBytes], srcSlice[y*stride:y*stride+rowBytes])
	}

	return &Frame{Width: d.width, Height: d.height, Pix: pix}
}

// Close melepas semua resource libav.
func (d *Decoder) Close() {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.closed {
		return
	}
	d.closed = true

	if d.swsCtx != nil {
		C.sws_freeContext(d.swsCtx)
	}
	if d.rgbBuf != nil {
		C.av_free(d.rgbBuf)
	}
	if d.packet != nil {
		C.av_packet_free(&d.packet)
	}
	if d.frame != nil {
		C.av_frame_free(&d.frame)
	}
	if d.rgbFrame != nil {
		C.av_frame_free(&d.rgbFrame)
	}
	if d.codecCtx != nil {
		C.avcodec_free_context(&d.codecCtx)
	}
	if d.fmtCtx != nil {
		C.avformat_close_input(&d.fmtCtx)
	}
}

func avErr(code C.int) string {
	buf := make([]C.char, C.AV_ERROR_MAX_STRING_SIZE)
	C.av_strerror(code, &buf[0], C.AV_ERROR_MAX_STRING_SIZE)
	return C.GoString(&buf[0])
}

package main

import (
	"context"
	"encoding/base64"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"os"
	"path/filepath"
	"strings"

	"auto-clipper/internal/overlay"
	"auto-clipper/internal/pipeline"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// === Overlay editor bindings (PRD docs/design/07) ===
//
// Lets the user append an image/video overlay to the bottom area of a rendered
// clip (default 30% height) with click sound + optional cover thumbnail.
// Data lives in the app's SQLite (overlay_* tables); rendering reuses the
// worker's ffmpeg via the new /overlay/* endpoints.

func (a *App) overlayDir(sub string) string {
	dir := filepath.Join(a.cfg.Paths.DataDir, "overlay", sub)
	os.MkdirAll(dir, 0755)
	return dir
}

// CreateOverlayProject makes a new overlay project from an arbitrary source
// video path (probed via the worker for dimensions/fps/duration).
func (a *App) CreateOverlayProject(sourceVideoPath, name, sourceClipID string) (overlay.Project, error) {
	if _, err := os.Stat(sourceVideoPath); err != nil {
		return overlay.Project{}, fmt.Errorf("source video not found: %w", err)
	}
	probe, err := a.worker.OverlayProbe(context.Background(), pipelineOverlayProbe(sourceVideoPath))
	if err != nil {
		return overlay.Project{}, fmt.Errorf("probe failed: %w", err)
	}
	if name == "" {
		name = strings.TrimSuffix(filepath.Base(sourceVideoPath), filepath.Ext(sourceVideoPath))
	}
	p := &overlay.Project{
		ID:              uuid.New().String(),
		Name:            name,
		SourceVideoPath: sourceVideoPath,
		SourceClipID:    sourceClipID,
		VideoWidth:      probe.Width,
		VideoHeight:     probe.Height,
		VideoFPS:        probe.FPS,
		VideoDuration:   probe.Duration,
	}
	if err := a.overlayRepo.CreateProject(p); err != nil {
		return overlay.Project{}, err
	}
	return *p, a.reloadOverlay(p)
}

// CreateOverlayFromClip is the Gallery entry point: resolves the clip's
// final rendered path and creates an overlay project around it.
func (a *App) CreateOverlayFromClip(clipID string) (overlay.Project, error) {
	c, err := a.clipRepo.GetByID(clipID)
	if err != nil {
		return overlay.Project{}, err
	}
	if c.FinalClipPath == "" {
		return overlay.Project{}, fmt.Errorf("clip has no rendered output yet")
	}
	name := c.Hook
	if name == "" {
		name = "Overlay " + clipID[:8]
	}
	return a.CreateOverlayProject(c.FinalClipPath, name, clipID)
}

func (a *App) GetOverlayProject(id string) (overlay.Project, error) {
	p, err := a.overlayRepo.GetProject(id)
	if err != nil {
		return overlay.Project{}, err
	}
	return *p, nil
}

func (a *App) ListOverlayProjects() ([]overlay.Project, error) {
	return a.overlayRepo.ListProjects()
}

// SaveOverlayProject persists the full project (layout/click/cover + all tracks).
// Called by the debounced auto-save on the frontend.
func (a *App) SaveOverlayProject(p overlay.Project) error {
	return a.overlayRepo.SaveProject(&p)
}

func (a *App) DeleteOverlayProject(id string) error {
	return a.overlayRepo.DeleteProject(id)
}

// --- Image library ---

// AddOverlayImage accepts either an absolute file path or a data-URI/base64
// PNG/JPEG, stores it under DataDir/overlay/images, and records it.
func (a *App) AddOverlayImage(srcPathOrBase64 string) (overlay.Image, error) {
	dir := a.overlayDir("images")
	id := uuid.New().String()
	var dst, name string

	if isBase64Image(srcPathOrBase64) {
		raw, ext, err := decodeDataURI(srcPathOrBase64)
		if err != nil {
			return overlay.Image{}, err
		}
		dst = filepath.Join(dir, id+ext)
		if err := os.WriteFile(dst, raw, 0644); err != nil {
			return overlay.Image{}, err
		}
		name = "pasted" + ext
	} else {
		if _, err := os.Stat(srcPathOrBase64); err != nil {
			return overlay.Image{}, fmt.Errorf("image not found: %w", err)
		}
		ext := filepath.Ext(srcPathOrBase64)
		dst = filepath.Join(dir, id+ext)
		if err := copyFile(srcPathOrBase64, dst); err != nil {
			return overlay.Image{}, err
		}
		name = filepath.Base(srcPathOrBase64)
	}

	w, h := imageDimensions(dst)
	img := &overlay.Image{ID: id, Path: dst, Name: name, Width: w, Height: h}
	if err := a.overlayRepo.CreateImage(img); err != nil {
		return overlay.Image{}, err
	}
	return *img, nil
}

func (a *App) ListOverlayImages() ([]overlay.Image, error) {
	return a.overlayRepo.ListImages()
}

func (a *App) DeleteOverlayImage(id string) error {
	return a.overlayRepo.DeleteImage(id)
}

// AddOverlayClip stores a secondary video to overlay (copied into DataDir) and
// returns it as an Image record (path + name; width/height from probe).
func (a *App) AddOverlayClip(srcPath string) (overlay.Image, error) {
	if _, err := os.Stat(srcPath); err != nil {
		return overlay.Image{}, fmt.Errorf("clip not found: %w", err)
	}
	dir := a.overlayDir("clips")
	id := uuid.New().String()
	dst := filepath.Join(dir, id+filepath.Ext(srcPath))
	if err := copyFile(srcPath, dst); err != nil {
		return overlay.Image{}, err
	}
	probe, err := a.worker.OverlayProbe(context.Background(), pipelineOverlayProbe(dst))
	if err != nil {
		log.Warn().Err(err).Msg("overlay clip probe failed; storing without dimensions")
	}
	img := overlay.Image{ID: id, Path: dst, Name: filepath.Base(srcPath)}
	if probe != nil {
		img.Width, img.Height = probe.Width, probe.Height
	}
	return img, nil
}

// --- Cover ---

func (a *App) SetOverlayCover(projectID, srcPathOrBase64 string) (overlay.Project, error) {
	dir := a.overlayDir("covers")
	var dst string
	if isBase64Image(srcPathOrBase64) {
		raw, ext, err := decodeDataURI(srcPathOrBase64)
		if err != nil {
			return overlay.Project{}, err
		}
		dst = filepath.Join(dir, projectID+ext)
		if err := os.WriteFile(dst, raw, 0644); err != nil {
			return overlay.Project{}, err
		}
	} else {
		if _, err := os.Stat(srcPathOrBase64); err != nil {
			return overlay.Project{}, fmt.Errorf("cover not found: %w", err)
		}
		dst = filepath.Join(dir, projectID+filepath.Ext(srcPathOrBase64))
		if err := copyFile(srcPathOrBase64, dst); err != nil {
			return overlay.Project{}, err
		}
	}
	if err := a.overlayRepo.SetCover(projectID, dst, 0.5); err != nil {
		return overlay.Project{}, err
	}
	return a.GetOverlayProject(projectID)
}

func (a *App) DeleteOverlayCover(projectID string) (overlay.Project, error) {
	p, err := a.overlayRepo.GetProject(projectID)
	if err != nil {
		return overlay.Project{}, err
	}
	if p.Cover != nil && p.Cover.Path != "" {
		os.Remove(p.Cover.Path)
	}
	if err := a.overlayRepo.SetCover(projectID, "", 0.5); err != nil {
		return overlay.Project{}, err
	}
	return a.GetOverlayProject(projectID)
}

// reloadOverlay is a no-op hook kept for symmetry with other pipelines; it
// validates the project re-reads cleanly after creation.
func (a *App) reloadOverlay(p *overlay.Project) error {
	_, err := a.overlayRepo.GetProject(p.ID)
	return err
}

// --- Native file pickers (WebView can't expose local file paths) ---

// PickOverlayClip opens a native file dialog and imports the chosen video as an
// overlay clip. Returns the imported asset (empty Image.ID if user cancelled).
func (a *App) PickOverlayClip() (overlay.Image, error) {
	path, err := wailsruntime.OpenFileDialog(a.ctx, wailsruntime.OpenDialogOptions{
		Title: "Pilih klip video overlay",
		Filters: []wailsruntime.FileFilter{
			{DisplayName: "Video", Pattern: "*.mp4;*.mov;*.mkv;*.webm;*.avi"},
		},
	})
	if err != nil {
		return overlay.Image{}, err
	}
	if path == "" {
		return overlay.Image{}, nil // cancelled
	}
	return a.AddOverlayClip(path)
}

// PickOverlayImage opens a native file dialog and imports the chosen image as an
// overlay image. Returns the imported asset (empty Image.ID if cancelled).
func (a *App) PickOverlayImage() (overlay.Image, error) {
	path, err := wailsruntime.OpenFileDialog(a.ctx, wailsruntime.OpenDialogOptions{
		Title: "Pilih gambar overlay",
		Filters: []wailsruntime.FileFilter{
			{DisplayName: "Gambar", Pattern: "*.png;*.jpg;*.jpeg;*.gif;*.webp"},
		},
	})
	if err != nil {
		return overlay.Image{}, err
	}
	if path == "" {
		return overlay.Image{}, nil
	}
	return a.AddOverlayImage(path)
}

// --- Render ---

// RenderOverlay starts the overlay render in the background and returns
// immediately. Progress/done/error arrive via overlay:render_* events.
func (a *App) RenderOverlay(projectID string) error {
	if _, err := a.overlayRepo.GetProject(projectID); err != nil {
		return err
	}
	go a.overlayGen.Render(context.Background(), projectID)
	return nil
}

func (a *App) CancelOverlayRender(projectID string) error {
	return a.overlayGen.Cancel(projectID)
}

// --- helpers ---

func pipelineOverlayProbe(path string) pipeline.OverlayProbeRequest {
	return pipeline.OverlayProbeRequest{VideoPath: path}
}

func isBase64Image(s string) bool {
	return strings.HasPrefix(s, "data:image/") || (len(s) > 256 && !strings.ContainsAny(s, "/\\") && !strings.Contains(s, "."))
}

func decodeDataURI(s string) (data []byte, ext string, err error) {
	ext = ".png"
	payload := s
	if strings.HasPrefix(s, "data:") {
		comma := strings.IndexByte(s, ',')
		if comma < 0 {
			return nil, "", fmt.Errorf("invalid data URI")
		}
		header := s[:comma]
		payload = s[comma+1:]
		if strings.Contains(header, "jpeg") || strings.Contains(header, "jpg") {
			ext = ".jpg"
		} else if strings.Contains(header, "gif") {
			ext = ".gif"
		}
	}
	data, err = base64.StdEncoding.DecodeString(payload)
	return data, ext, err
}

func imageDimensions(path string) (int, int) {
	f, err := os.Open(path)
	if err != nil {
		return 0, 0
	}
	defer f.Close()
	cfg, _, err := image.DecodeConfig(f)
	if err != nil {
		return 0, 0
	}
	return cfg.Width, cfg.Height
}

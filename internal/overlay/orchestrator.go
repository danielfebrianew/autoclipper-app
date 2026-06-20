package overlay

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"sync"

	"auto-clipper/internal/config"
	"auto-clipper/internal/pipeline"

	"github.com/rs/zerolog/log"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// Generator orchestrates an overlay render: it computes the segment plan in Go
// (mirroring ContextClipper's render.py build_segments), invokes the worker to
// render each segment, then concatenates. Progress is emitted to the frontend.
type Generator struct {
	cfg      *config.Config
	worker   *pipeline.WorkerClient
	repo     *Repository
	wailsCtx context.Context

	mu      sync.Mutex
	cancels map[string]context.CancelFunc
}

func NewGenerator(cfg *config.Config, worker *pipeline.WorkerClient, repo *Repository, wailsCtx context.Context) *Generator {
	return &Generator{
		cfg:      cfg,
		worker:   worker,
		repo:     repo,
		wailsCtx: wailsCtx,
		cancels:  make(map[string]context.CancelFunc),
	}
}

func (g *Generator) emit(event string, payload interface{}) {
	wailsruntime.EventsEmit(g.wailsCtx, event, payload)
}

// Cancel stops an in-progress render for the given project.
func (g *Generator) Cancel(projectID string) error {
	g.mu.Lock()
	cancel, ok := g.cancels[projectID]
	g.mu.Unlock()
	if !ok {
		return fmt.Errorf("no active overlay render for project %s", projectID)
	}
	cancel()
	return nil
}

// segment is a contiguous span of the timeline. tracks empty = copy span,
// non-empty = overlay span (all tracks active for the whole span).
type segment struct {
	start  float64
	end    float64
	tracks []Track
}

func codecHint() string {
	if runtime.GOOS == "darwin" {
		return "h264_videotoolbox"
	}
	return "libx264"
}

// normalizeTracks clamps tracks to the video duration and drops invalid ones.
func normalizeTracks(p *Project) []Track {
	out := make([]Track, 0, len(p.Tracks))
	for _, t := range p.Tracks {
		if t.StartSec >= p.VideoDuration {
			continue
		}
		c := t
		if c.EndSec > p.VideoDuration {
			c.EndSec = p.VideoDuration
		}
		if c.EndSec > c.StartSec {
			out = append(out, c)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].StartSec < out[j].StartSec })
	return out
}

// buildSegments splits the timeline at every track boundary; each segment is
// either a copy span (no tracks) or an overlay span (tracks active throughout).
func buildSegments(tracks []Track, duration float64) []segment {
	if len(tracks) == 0 {
		return []segment{{0, duration, nil}}
	}
	pointSet := map[float64]struct{}{0: {}, duration: {}}
	for _, t := range tracks {
		pointSet[t.StartSec] = struct{}{}
		pointSet[t.EndSec] = struct{}{}
	}
	points := make([]float64, 0, len(pointSet))
	for p := range pointSet {
		points = append(points, p)
	}
	sort.Float64s(points)

	var segs []segment
	for i := 0; i < len(points)-1; i++ {
		s, e := points[i], points[i+1]
		if e-s < 0.001 {
			continue
		}
		var active []Track
		for _, t := range tracks {
			if t.StartSec <= s && t.EndSec >= e {
				active = append(active, t)
			}
		}
		segs = append(segs, segment{s, e, active})
	}
	return segs
}

// Render runs the full pipeline in the calling goroutine. Caller should `go` it.
func (g *Generator) Render(ctx context.Context, projectID string) {
	ctx, cancel := context.WithCancel(ctx)
	g.mu.Lock()
	g.cancels[projectID] = cancel
	g.mu.Unlock()
	defer func() {
		g.mu.Lock()
		delete(g.cancels, projectID)
		g.mu.Unlock()
		cancel()
	}()

	p, err := g.repo.GetProject(projectID)
	if err != nil {
		g.fail(projectID, err.Error())
		return
	}
	if p.SourceVideoPath == "" {
		g.fail(projectID, "project has no source video")
		return
	}
	if _, err := os.Stat(p.SourceVideoPath); err != nil {
		g.fail(projectID, "source video missing on disk")
		return
	}

	tmpDir := filepath.Join(g.cfg.Paths.DataDir, "overlay", "tmp", projectID)
	os.MkdirAll(tmpDir, 0755)
	defer os.RemoveAll(tmpDir)

	outDir := g.cfg.Paths.OutputDir
	os.MkdirAll(outDir, 0755)
	output := filepath.Join(outDir, "overlay_"+projectID+".mp4")

	tracks := normalizeTracks(p)
	segs := buildSegments(tracks, p.VideoDuration)
	hasOverlay := false
	for _, s := range segs {
		if len(s.tracks) > 0 {
			hasOverlay = true
			break
		}
	}

	// Output dimensions: forced to aspect_ratio, keeping source height.
	outW, outH := resolveOutputDimensions(p.VideoWidth, p.VideoHeight, p.Layout.AspectRatio)
	hint := codecHint()

	var segPaths []string

	// Cover first (if any).
	if p.Cover != nil && p.Cover.Path != "" {
		coverPath := filepath.Join(tmpDir, "cover.mp4")
		g.progress(projectID, 2, 0, len(segs)+1, "Rendering cover…")
		_, err := g.worker.OverlayRenderSegment(ctx, pipeline.OverlayRenderSegmentRequest{
			Kind: "cover", OutPath: coverPath,
			OutWidth: outW, OutHeight: outH, FPS: p.VideoFPS, CodecHint: hint,
			BackgroundColor: p.Layout.BackgroundColor,
			CoverImage:      p.Cover.Path, CoverDuration: p.Cover.DurationSec,
		})
		if err != nil {
			g.fail(projectID, "cover: "+err.Error())
			return
		}
		segPaths = append(segPaths, coverPath)
	}

	total := len(segs)
	for i, s := range segs {
		select {
		case <-ctx.Done():
			g.fail(projectID, "render cancelled")
			return
		default:
		}

		segOut := filepath.Join(tmpDir, fmt.Sprintf("seg_%04d.mp4", i))
		segPaths = append(segPaths, segOut)
		pct := 5 + float64(i)/float64(total)*85
		req := pipeline.OverlayRenderSegmentRequest{
			SourcePath: p.SourceVideoPath, OutPath: segOut,
			SegStart: s.start, SegEnd: s.end,
			OutWidth: outW, OutHeight: outH, FPS: p.VideoFPS, CodecHint: hint,
			BackgroundColor: p.Layout.BackgroundColor, AreaRatio: p.Layout.ImageAreaRatio,
		}
		if len(s.tracks) > 0 {
			req.Kind = "overlay"
			req.Overlays = g.toOverlaySpecs(p, s)
			req.Click = pipeline.OverlayClickSpec{
				Enabled: p.ClickSound.Enabled, Volume: p.ClickSound.Volume,
				AssetPath: g.clickAsset(),
			}
			g.progress(projectID, pct, i+1, total, fmt.Sprintf("Overlay %d/%d", i+1, total))
		} else {
			req.Kind = "copy"
			// Force re-encode copy spans when the timeline has overlay spans, so
			// audio timestamps stay consistent on concat (see render.py note).
			req.ForceReencode = hasOverlay
			g.progress(projectID, pct, i+1, total, fmt.Sprintf("Segmen %d/%d", i+1, total))
		}

		if _, err := g.worker.OverlayRenderSegment(ctx, req); err != nil {
			g.fail(projectID, fmt.Sprintf("segment %d: %s", i, err.Error()))
			return
		}
	}

	// Concat (or single rename handled worker-side).
	g.progress(projectID, 95, total, total, "Menggabungkan…")
	_, err = g.worker.OverlayConcat(ctx, pipeline.OverlayConcatRequest{
		Inputs: segPaths, OutPath: output, TmpDir: tmpDir, TryStreamCopy: true,
	})
	if err != nil {
		g.fail(projectID, "concat: "+err.Error())
		return
	}

	log.Info().Str("project", projectID).Str("output", output).Msg("Overlay render done")
	g.emit("overlay:render_done", map[string]string{
		"project_id":  projectID,
		"output_path": output,
	})
}

func (g *Generator) toOverlaySpecs(p *Project, s segment) []pipeline.OverlaySpec {
	specs := make([]pipeline.OverlaySpec, 0, len(s.tracks))
	for _, t := range s.tracks {
		fit := t.FitOverride
		if fit == "" {
			fit = p.Layout.ImageFit
		}
		spec := pipeline.OverlaySpec{Kind: t.Kind, Path: t.AssetPath, Fit: fit}
		if t.Kind == "video" {
			spec.TrimOffset = t.TrimStartSec + (s.start - t.StartSec)
		}
		specs = append(specs, spec)
	}
	return specs
}

// clickAsset returns an absolute path to the click sound, copying the bundled
// asset into DataDir on first use so the worker (a separate process whose cwd
// may differ) can always read it. Empty string = no click available.
func (g *Generator) clickAsset() string {
	dst := filepath.Join(g.cfg.Paths.DataDir, "overlay", "click.mp3")
	if _, err := os.Stat(dst); err == nil {
		return dst
	}
	// Seed from the repo-bundled asset (resolved relative to cwd).
	if src, err := filepath.Abs(filepath.Join("worker", "assets", "click.mp3")); err == nil {
		if data, rerr := os.ReadFile(src); rerr == nil {
			os.MkdirAll(filepath.Dir(dst), 0755)
			if werr := os.WriteFile(dst, data, 0644); werr == nil {
				return dst
			}
			return src // fall back to the source path if copy failed
		}
	}
	return ""
}

func (g *Generator) progress(projectID string, percent float64, seg, total int, msg string) {
	g.emit("overlay:render_progress", map[string]interface{}{
		"project_id":     projectID,
		"percent":        percent,
		"segment":        seg,
		"total_segments": total,
		"message":        msg,
	})
}

func (g *Generator) fail(projectID, msg string) {
	log.Error().Str("project", projectID).Str("error", msg).Msg("Overlay render failed")
	g.emit("overlay:render_error", map[string]string{
		"project_id": projectID,
		"error":      msg,
	})
}

// resolveOutputDimensions forces the source to aspect_ratio, keeping the source
// height. Mirrors render.py resolve_output_dimensions.
func resolveOutputDimensions(w, h int, aspectRatio string) (int, int) {
	var rw, rh int
	if _, err := fmt.Sscanf(aspectRatio, "%d:%d", &rw, &rh); err != nil || rw == 0 || rh == 0 {
		return w, h
	}
	targetW := int(float64(h) * float64(rw) / float64(rh))
	targetH := h
	if targetW%2 != 0 {
		targetW++
	}
	if targetH%2 != 0 {
		targetH++
	}
	return targetW, targetH
}

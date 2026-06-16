package pipeline

import (
	"context"
	"fmt"
	"path/filepath"
	"sync"

	"auto-clipper/internal/clip"
	"auto-clipper/internal/config"

	"github.com/rs/zerolog/log"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type ClipProgressEvent struct {
	ClipID  string  `json:"clip_id"`
	Step    string  `json:"step"`
	Percent float64 `json:"percent"`
	Message string  `json:"message"`
}

type Generator struct {
	cfg      *config.Config
	worker   *WorkerClient
	clipRepo *clip.Repository
	wailsCtx context.Context

	mu      sync.Mutex
	cancels map[string]context.CancelFunc
}

func NewGenerator(
	cfg *config.Config,
	worker *WorkerClient,
	clipRepo *clip.Repository,
	wailsCtx context.Context,
) *Generator {
	return &Generator{
		cfg:      cfg,
		worker:   worker,
		clipRepo: clipRepo,
		wailsCtx: wailsCtx,
		cancels:  make(map[string]context.CancelFunc),
	}
}

func (g *Generator) emit(event string, payload interface{}) {
	runtime.EventsEmit(g.wailsCtx, event, payload)
}

// Cancel stops an in-progress generation for the given projectID.
func (g *Generator) Cancel(projectID string) error {
	g.mu.Lock()
	cancel, ok := g.cancels[projectID]
	g.mu.Unlock()
	if !ok {
		return fmt.Errorf("no active generation for project %s", projectID)
	}
	cancel()
	return nil
}

func (g *Generator) GenerateAll(ctx context.Context, projectID, videoPath string, clips []clip.Clip) {
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

	successCount, failCount := 0, 0

	for _, c := range clips {
		select {
		case <-ctx.Done():
			g.clipRepo.UpdateStatus(c.ID, "cancelled")
			g.emit("clip:error", map[string]string{
				"clip_id": c.ID, "step": "cancelled", "error": "generation cancelled",
			})
			failCount++
			continue
		default:
		}

		if !c.Enabled {
			continue
		}
		if err := g.generateClip(ctx, videoPath, c); err != nil {
			log.Error().Err(err).Str("clip_id", c.ID).Msg("Clip generation failed")
			g.clipRepo.UpdateStatus(c.ID, "error")
			g.emit("clip:error", map[string]string{
				"clip_id": c.ID,
				"step":    "generate",
				"error":   err.Error(),
			})
			failCount++
		} else {
			successCount++
		}
	}

	g.emit("generate:complete", map[string]interface{}{
		"project_id":    projectID,
		"success_count": successCount,
		"fail_count":    failCount,
	})
}

func (g *Generator) generateClip(ctx context.Context, videoPath string, c clip.Clip) error {
	return g.runClipPipeline(ctx, videoPath, c, false)
}

// GeneratePreview renders a fast draft clip: whisper tiny + static crop.
// Output goes to OutputDir/preview_<clipID>.mp4 and emits "clip:preview" event.
func (g *Generator) GeneratePreview(ctx context.Context, projectID, videoPath string, clips []clip.Clip) {
	for _, c := range clips {
		if !c.Enabled {
			continue
		}
		if err := g.runClipPipeline(ctx, videoPath, c, true); err != nil {
			log.Error().Err(err).Str("clip_id", c.ID).Msg("Preview generation failed")
			g.emit("clip:error", map[string]string{
				"clip_id": c.ID, "step": "preview", "error": err.Error(),
			})
		}
	}
}

func (g *Generator) runClipPipeline(ctx context.Context, videoPath string, c clip.Clip, preview bool) error {
	suffix := ""
	if preview {
		suffix = " [PREVIEW]"
	}

	emitStep := func(step string, pct float64, msg string) {
		g.emit("clip:progress", ClipProgressEvent{
			ClipID:  c.ID,
			Step:    step,
			Percent: pct,
			Message: msg + suffix,
		})
		log.Info().Str("clip_id", c.ID).Str("step", step).Bool("preview", preview).Msg(msg)
	}

	outDir := filepath.Join(g.cfg.Paths.DataDir, "clips", c.ID)
	modelsDir := filepath.Join(g.cfg.Paths.DataDir, "models")

	// Resolve per-clip settings with defaults
	ratio := c.AspectRatio
	if ratio == "" {
		ratio = "9:16"
	}
	captionStyle := c.CaptionStyle
	if captionStyle == "" {
		captionStyle = "bold"
	}
	captionPosition := c.CaptionPosition
	if captionPosition == "" {
		captionPosition = "bot"
	}
	captionSize := c.CaptionSize
	if captionSize == "" {
		captionSize = "M"
	}
	trackTemplate := c.TrackTemplate
	if trackTemplate == "" {
		trackTemplate = "single"
	}

	// Preview mode overrides: fast whisper model + static crop (no face tracking)
	whisperModel := g.cfg.Models.Whisper
	if preview {
		if g.cfg.Preview.WhisperModel != "" {
			whisperModel = g.cfg.Preview.WhisperModel
		} else {
			whisperModel = "tiny"
		}
		if g.cfg.Preview.TrackTemplate != "" {
			trackTemplate = g.cfg.Preview.TrackTemplate
		} else {
			trackTemplate = "static"
		}
	}

	// Step 1: cut
	emitStep("cut", 10, "Cutting clip...")
	cutResp, err := g.worker.Cut(ctx, CutRequest{
		VideoPath: videoPath,
		ClipID:    c.ID,
		Start:     c.StartSeconds,
		End:       c.EndSeconds,
		OutDir:    outDir,
	})
	if err != nil {
		return fmt.Errorf("cut: %w", err)
	}
	if !preview {
		g.clipRepo.UpdateField(c.ID, "raw_clip_path", cutResp.ClipPath)
	}

	// Step 2: whisper alignment
	emitStep("whisper", 25, fmt.Sprintf("Generating subtitles (model: %s)...", whisperModel))
	whisperResp, err := g.worker.WhisperAlign(ctx, WhisperRequest{
		AudioPath: cutResp.ClipPath,
		Language:  g.cfg.Processing.TranscriptLanguage,
		ModelSize: whisperModel,
	})
	if err != nil {
		return fmt.Errorf("whisper: %w", err)
	}

	// Step 3: reframe — scene-aware streaming crop + face tracking (satu pass baca video)
	emitStep("reframe", 45, fmt.Sprintf("Tracking faces + crop %s (%s)...", ratio, trackTemplate))
	reframeResp, err := g.worker.Reframe(ctx, ReframeRequest{
		ClipPath:  cutResp.ClipPath,
		ModelPath: filepath.Join(modelsDir, g.cfg.Models.YOLOFace),
		Ratio:     ratio,
		Template:  trackTemplate,
	})
	if err != nil {
		return fmt.Errorf("reframe: %w", err)
	}
	log.Info().
		Str("clip_id", c.ID).
		Int("centers", len(reframeResp.Centers)).
		Int("source_w", reframeResp.SourceW).
		Int("source_h", reframeResp.SourceH).
		Bool("preview", preview).
		Msg("Reframe done")

	// Step 4: subtitle
	emitStep("subtitle", 65, "Generating subtitles...")
	splitMode := trackTemplate == "dual" || trackTemplate == "dual_side"
	clipDuration := float64(c.EndSeconds - c.StartSeconds)
	subtitleResp, err := g.worker.GenerateSubtitle(ctx, SubtitleRequest{
		Words:        whisperResp.Words,
		Style:        captionStyle,
		Position:     captionPosition,
		Size:         captionSize,
		CaptionText:  c.CaptionText,
		ClipDuration: clipDuration,
		OutDir:       outDir,
		ClipID:       c.ID,
		SplitMode:    splitMode,
	})
	if err != nil {
		return fmt.Errorf("subtitle: %w", err)
	}
	if !preview {
		g.clipRepo.UpdateField(c.ID, "subtitle_path", subtitleResp.ASSPath)
	}

	// Step 5: composite — per-frame crop piping ke ffmpeg
	emitStep("composite", 82, "Rendering final clip...")

	// Preview output goes to a separate file so it doesn't overwrite the final render
	outputDir := g.cfg.Paths.OutputDir
	clipID := c.ID
	if preview {
		outputDir = filepath.Join(g.cfg.Paths.DataDir, "previews")
		clipID = "preview_" + c.ID
	}

	compositeResp, err := g.worker.Composite(ctx, CompositeRequest{
		ClipPath:     cutResp.ClipPath,
		ASSPath:      subtitleResp.ASSPath,
		Centers:      reframeResp.Centers,
		CentersLeft:  reframeResp.CentersLeft,
		CentersRight: reframeResp.CentersRight,
		IsSplit:      reframeResp.IsSplit,
		SourceW:      reframeResp.SourceW,
		SourceH:      reframeResp.SourceH,
		ClipID:       clipID,
		OutDir:       outputDir,
		Ratio:        ratio,
	})
	if err != nil {
		return fmt.Errorf("composite: %w", err)
	}

	if preview {
		g.emit("clip:preview", map[string]string{
			"clip_id":      c.ID,
			"preview_path": compositeResp.OutputPath,
		})
		emitStep("done", 100, "Preview ready!")
		return nil
	}

	g.clipRepo.UpdateFinalPath(c.ID, compositeResp.OutputPath)
	g.emit("clip:done", map[string]string{
		"clip_id":     c.ID,
		"output_path": compositeResp.OutputPath,
	})
	emitStep("done", 100, "Clip ready!")
	return nil
}

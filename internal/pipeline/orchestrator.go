package pipeline

import (
	"context"
	"encoding/json"
	"fmt"
	"path/filepath"
	"strings"

	"auto-clipper/internal/clip"
	"auto-clipper/internal/config"
	"auto-clipper/internal/project"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type ProgressEvent struct {
	ProjectID string  `json:"project_id"`
	Step      string  `json:"step"`
	Percent   float64 `json:"percent"`
	Message   string  `json:"message"`
}

type Orchestrator struct {
	cfg       *config.Config
	worker    *WorkerClient
	projectSvc *project.Service
	projectRepo *project.Repository
	clipRepo  *clip.Repository
	wailsCtx  context.Context
}

func NewOrchestrator(
	cfg *config.Config,
	worker *WorkerClient,
	projectSvc *project.Service,
	projectRepo *project.Repository,
	clipRepo *clip.Repository,
	wailsCtx context.Context,
) *Orchestrator {
	return &Orchestrator{
		cfg:         cfg,
		worker:      worker,
		projectSvc:  projectSvc,
		projectRepo: projectRepo,
		clipRepo:    clipRepo,
		wailsCtx:    wailsCtx,
	}
}

func (o *Orchestrator) emit(event string, payload interface{}) {
	runtime.EventsEmit(o.wailsCtx, event, payload)
}

// RunAnalyzeOnly re-runs the AI analysis step using transcript + heatmap already
// stored in the DB. Skips download and transcript fetch. Appends new clips without
// touching existing ones. excludeClips is forwarded to the worker to steer the AI
// away from already-picked moments.
func (o *Orchestrator) RunAnalyzeOnly(ctx context.Context, projectID, apiKey string, excludeClips []ExcludeClip) error {
	emit := func(step string, pct float64, msg string) {
		o.emit("download:progress", ProgressEvent{
			ProjectID: projectID,
			Step:      step,
			Percent:   pct,
			Message:   msg,
		})
		log.Info().Str("project_id", projectID).Str("step", step).Float64("pct", pct).Msg(msg)
	}

	fail := func(step string, err error) error {
		o.emit("download:error", map[string]string{"project_id": projectID, "step": step, "error": err.Error()})
		o.projectRepo.UpdateStatus(projectID, "error")
		return err
	}

	p, err := o.projectRepo.GetByID(projectID)
	if err != nil {
		return fail("load", err)
	}

	// If transcript is missing, fetch it now.
	transcriptJSON := p.TranscriptJSON
	var txSegments []TranscriptSegment
	if transcriptJSON == "" {
		emit("transcript", 50, "Mengambil transkrip…")
		o.projectRepo.UpdateStatus(projectID, "transcript")
		txResp, err := o.worker.FetchTranscript(ctx, TranscriptRequest{
			VideoID:  p.VideoID,
			Language: o.cfg.Processing.TranscriptLanguage,
		})
		if err != nil {
			return fail("transcript", err)
		}
		txSegments = txResp.Segments
		txBytes, _ := json.Marshal(txSegments)
		transcriptJSON = string(txBytes)
		o.projectRepo.UpdateField(projectID, "transcript_json", transcriptJSON)
	} else {
		if err := json.Unmarshal([]byte(transcriptJSON), &txSegments); err != nil {
			return fail("transcript", fmt.Errorf("transcript_json corrupt: %w", err))
		}
	}

	// Format transcript [MM:SS]
	var txLines []string
	for _, seg := range txSegments {
		totalSec := int(seg.Start)
		m, s := totalSec/60, totalSec%60
		txLines = append(txLines, fmt.Sprintf("[%02d:%02d] %s", m, s, seg.Text))
	}

	// Heatmap (optional)
	heatmapText := ""
	if p.HeatmapJSON != "" {
		entries, _ := ParseHeatmap(p.HeatmapJSON)
		heatmapText = FormatHeatmapForLLM(entries, o.cfg.Heatmap.PeakThreshold, o.cfg.Heatmap.HighThreshold)
	}

	emit("analyze", 70, "Menganalisis dengan AI (cari klip baru)…")
	o.projectRepo.UpdateStatus(projectID, "analyzing")

	analyzeResp, err := o.worker.Analyze(ctx, AnalyzeRequest{
		Transcript:           strings.Join(txLines, "\n"),
		HeatmapText:          heatmapText,
		Title:                p.Title,
		Channel:              p.Channel,
		Duration:             p.Duration,
		APIKey:               apiKey,
		Model:                o.cfg.Gemini.Model,
		BaseURL:              o.cfg.Gemini.BaseURL,
		MaxClips:             o.cfg.Processing.MaxClips,
		MinDuration:          o.cfg.Processing.MinDuration,
		MaxDuration:          o.cfg.Processing.MaxDuration,
		BufferSeconds:        o.cfg.Processing.BufferSeconds,
		Snippets:             txSegments,
		VideoDurationSeconds: p.Duration,
		ExcludeClips:         excludeClips,
	})
	if err != nil {
		return fail("analyze", err)
	}

	// Determine next clip_index
	existingClips, _ := o.clipRepo.GetByProject(projectID)
	maxIndex := 0
	for _, c := range existingClips {
		if c.ClipIndex > maxIndex {
			maxIndex = c.ClipIndex
		}
	}

	// Dedup: filter recommendations that overlap >50% with existing clips
	filtered := analyzeResp.Clips[:0]
	for _, rec := range analyzeResp.Clips {
		overlap := false
		for _, ex := range existingClips {
			overlapStart := max(rec.StartSeconds, ex.StartSeconds)
			overlapEnd := min(rec.EndSeconds, ex.EndSeconds)
			if overlapEnd > overlapStart {
				recDur := rec.EndSeconds - rec.StartSeconds
				if recDur > 0 && float64(overlapEnd-overlapStart)/float64(recDur) > 0.5 {
					overlap = true
					break
				}
			}
		}
		if !overlap {
			filtered = append(filtered, rec)
		}
	}

	var newClips []clip.Clip
	for i, rec := range filtered {
		dur := rec.EndSeconds - rec.StartSeconds
		if rec.DurationSeconds > 0 {
			dur = rec.DurationSeconds
		}
		newClips = append(newClips, clip.Clip{
			ID:                 uuid.New().String(),
			ProjectID:          projectID,
			ClipIndex:          maxIndex + i + 1,
			StartSeconds:       rec.StartSeconds,
			EndSeconds:         rec.EndSeconds,
			DurationSeconds:    dur,
			Speaker:            rec.Speaker,
			Hook:               rec.Hook,
			Summary:            rec.Summary,
			Category:           rec.Category,
			EnergyLevel:        rec.EnergyLevel,
			ViralScore:         rec.ViralScore,
			ContentScore:       rec.ContentScore,
			EngagementScore:    rec.EngagementScore,
			ThumbnailText:      rec.ThumbnailText,
			ThumbnailEmotion:   rec.ThumbnailEmotion,
			ThumbnailTimestamp: rec.ThumbnailTimestamp,
			SuggestedCaption:   rec.SuggestedCaption,
			TranscriptExcerpt:  rec.TranscriptExcerpt,
			Enabled:            true,
			Status:             "pending",
		})
	}

	if len(newClips) > 0 {
		if err := o.clipRepo.CreateBatch(newClips); err != nil {
			return fail("save_clips", err)
		}
	}

	o.projectRepo.UpdateStatus(projectID, "ready")
	o.emit("download:complete", map[string]interface{}{
		"project_id": projectID,
		"new_clips":  len(newClips),
	})
	log.Info().Str("project_id", projectID).Int("new_clips", len(newClips)).Msg("FindMoreClips done")
	return nil
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func (o *Orchestrator) RunDownloadAndAnalyze(ctx context.Context, projectID, youtubeURL, apiKey string) error {
	emit := func(step string, pct float64, msg string) {
		o.emit("download:progress", ProgressEvent{
			ProjectID: projectID,
			Step:      step,
			Percent:   pct,
			Message:   msg,
		})
		log.Info().Str("project_id", projectID).Str("step", step).Float64("pct", pct).Msg(msg)
	}

	fail := func(step string, err error) error {
		o.emit("download:error", map[string]string{"project_id": projectID, "step": step, "error": err.Error()})
		o.projectRepo.UpdateStatus(projectID, "error")
		return err
	}

	// Step 1: metadata
	emit("metadata", 5, "Fetching video metadata...")
	o.projectRepo.UpdateStatus(projectID, "metadata")
	meta, err := o.worker.FetchMetadata(ctx, MetadataRequest{URL: youtubeURL})
	if err != nil {
		return fail("metadata", err)
	}

	heatmapBytes, _ := json.Marshal(meta.HeatmapJSON)
	o.projectRepo.UpdateField(projectID, "title", meta.Title)
	o.projectRepo.UpdateField(projectID, "duration", meta.Duration)
	o.projectRepo.UpdateField(projectID, "views", meta.Views)
	o.projectRepo.UpdateField(projectID, "heatmap_json", string(heatmapBytes))
	emit("metadata", 15, fmt.Sprintf("Fetched: %s (%ds)", meta.Title, meta.Duration))

	// Step 2: download (streaming progress)
	emit("download", 20, "Mengunduh video…")
	o.projectRepo.UpdateStatus(projectID, "downloading")
	dlResp, err := o.worker.Download(ctx, DownloadRequest{
		URL:     youtubeURL,
		VideoID: meta.VideoID,
		OutDir:  filepath.Join(o.cfg.Paths.DataDir, "videos"),
	}, func(pct float64, msg string) {
		// Map yt-dlp 0-100 into the 20-44 slice of overall pipeline progress
		overall := 20 + pct*0.24
		emit("download", overall, msg)
	})
	if err != nil {
		return fail("download", err)
	}
	o.projectRepo.UpdateField(projectID, "video_path", dlResp.VideoPath)
	emit("download", 45, "Download selesai")

	// Step 3: transcript
	emit("transcript", 50, "Fetching transcript...")
	o.projectRepo.UpdateStatus(projectID, "transcript")
	txResp, err := o.worker.FetchTranscript(ctx, TranscriptRequest{
		VideoID:  meta.VideoID,
		Language: o.cfg.Processing.TranscriptLanguage,
	})
	if err != nil {
		return fail("transcript", err)
	}
	txBytes, _ := json.Marshal(txResp.Segments)
	o.projectRepo.UpdateField(projectID, "transcript_json", string(txBytes))
	emit("transcript", 60, fmt.Sprintf("Transcript: %d segments", len(txResp.Segments)))

	// Step 4: heatmap analysis (local)
	emit("heatmap", 65, "Analyzing engagement heatmap...")
	heatmapEntries, _ := ParseHeatmap(string(heatmapBytes))
	heatmapText := FormatHeatmapForLLM(heatmapEntries,
		o.cfg.Heatmap.PeakThreshold,
		o.cfg.Heatmap.HighThreshold)

	// Step 5: Gemini analysis
	emit("analyze", 70, "Analyzing with Gemini AI...")
	o.projectRepo.UpdateStatus(projectID, "analyzing")

	// Format transcript [MM:SS] untuk prompt podcast-analyst
	var txLines []string
	for _, seg := range txResp.Segments {
		totalSec := int(seg.Start)
		m, s := totalSec/60, totalSec%60
		txLines = append(txLines, fmt.Sprintf("[%02d:%02d] %s", m, s, seg.Text))
	}

	analyzeResp, err := o.worker.Analyze(ctx, AnalyzeRequest{
		Transcript:           strings.Join(txLines, "\n"),
		HeatmapText:          heatmapText,
		Title:                meta.Title,
		Channel:              meta.Channel,
		Duration:             meta.Duration,
		APIKey:               apiKey,
		Model:                o.cfg.Gemini.Model,
		BaseURL:              o.cfg.Gemini.BaseURL,
		MaxClips:             o.cfg.Processing.MaxClips,
		MinDuration:          o.cfg.Processing.MinDuration,
		MaxDuration:          o.cfg.Processing.MaxDuration,
		BufferSeconds:        o.cfg.Processing.BufferSeconds,
		Snippets:             txResp.Segments,
		VideoDurationSeconds: meta.Duration,
	})
	if err != nil {
		return fail("analyze", err)
	}

	geminiBytes, _ := json.Marshal(analyzeResp)
	o.projectRepo.UpdateField(projectID, "gemini_json", string(geminiBytes))
	emit("analyze", 85, fmt.Sprintf("Found %d clip recommendations", len(analyzeResp.Clips)))

	// Save clips
	var clips []clip.Clip
	for i, rec := range analyzeResp.Clips {
		clipIndex := rec.ClipID
		if clipIndex == 0 {
			clipIndex = i + 1
		}
		dur := rec.EndSeconds - rec.StartSeconds
		if rec.DurationSeconds > 0 {
			dur = rec.DurationSeconds
		}
		clips = append(clips, clip.Clip{
			ID:                 uuid.New().String(),
			ProjectID:          projectID,
			ClipIndex:          clipIndex,
			StartSeconds:       rec.StartSeconds,
			EndSeconds:         rec.EndSeconds,
			DurationSeconds:    dur,
			Speaker:            rec.Speaker,
			Hook:               rec.Hook,
			Summary:            rec.Summary,
			Category:           rec.Category,
			EnergyLevel:        rec.EnergyLevel,
			ViralScore:         rec.ViralScore,
			ContentScore:       rec.ContentScore,
			EngagementScore:    rec.EngagementScore,
			ThumbnailText:      rec.ThumbnailText,
			ThumbnailEmotion:   rec.ThumbnailEmotion,
			ThumbnailTimestamp: rec.ThumbnailTimestamp,
			SuggestedCaption:   rec.SuggestedCaption,
			TranscriptExcerpt:  rec.TranscriptExcerpt,
			Enabled:            true,
			Status:             "pending",
		})
	}

	if err := o.clipRepo.CreateBatch(clips); err != nil {
		return fail("save_clips", err)
	}

	o.projectRepo.UpdateStatus(projectID, "ready")
	o.emit("download:complete", map[string]string{"project_id": projectID})
	log.Info().Str("project_id", projectID).Msg("Project ready for editing")
	return nil
}

package main

import (
	"archive/zip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"time"

	"auto-clipper/internal/asset"
	"auto-clipper/internal/clip"
	"auto-clipper/internal/config"
	"auto-clipper/internal/license"
	"auto-clipper/internal/overlay"
	"auto-clipper/internal/pipeline"
	"auto-clipper/internal/project"
	"auto-clipper/internal/settings"
	"auto-clipper/internal/setup"
	"auto-clipper/internal/video"

	"github.com/rs/zerolog/log"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx          context.Context
	cfg          *config.Config
	projectSvc   *project.Service
	projectRepo  *project.Repository
	videoRepo    *video.Repository
	clipSvc      *clip.Service
	clipRepo     *clip.Repository
	assetRepo    *asset.Repository
	settingsSvc  *settings.Service
	worker       *pipeline.WorkerClient
	orchestrator *pipeline.Orchestrator
	generator    *pipeline.Generator
	overlayRepo  *overlay.Repository
	overlayGen   *overlay.Generator
}

func NewApp(cfg *config.Config) *App {
	return &App{cfg: cfg}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) wire(
	projectSvc *project.Service,
	projectRepo *project.Repository,
	videoRepo *video.Repository,
	clipSvc *clip.Service,
	clipRepo *clip.Repository,
	assetRepo *asset.Repository,
	settingsSvc *settings.Service,
	overlayRepo *overlay.Repository,
) {
	a.projectSvc = projectSvc
	a.projectRepo = projectRepo
	a.videoRepo = videoRepo
	a.clipSvc = clipSvc
	a.clipRepo = clipRepo
	a.assetRepo = assetRepo
	a.settingsSvc = settingsSvc
	a.overlayRepo = overlayRepo
	a.worker = pipeline.NewWorkerClient(a.cfg.Worker.Host, a.cfg.Worker.Port)
}

func (a *App) initPipelines() {
	a.orchestrator = pipeline.NewOrchestrator(
		a.cfg, a.worker, a.projectSvc, a.projectRepo, a.videoRepo, a.clipRepo, a.ctx)
	a.generator = pipeline.NewGenerator(a.cfg, a.worker, a.clipRepo, a.ctx)
	a.overlayGen = overlay.NewGenerator(a.cfg, a.worker, a.overlayRepo, a.ctx)
}

// === Lifecycle / Setup ===

func (a *App) IsSetupComplete() bool {
	deps := setup.CheckDependencies(a.cfg)
	for _, d := range deps {
		if d.Status != setup.StatusOK {
			return false
		}
	}
	return true
}

func (a *App) CheckDependencies() []setup.Dependency {
	return setup.CheckDependencies(a.cfg)
}

func (a *App) RunSetup() error {
	return setup.RunSetup(a.cfg, func(ev setup.ProgressEvent) {
		log.Info().Str("dep", ev.Name).Float64("progress", ev.Progress).Msg(ev.Message)
		wailsruntime.EventsEmit(a.ctx, "setup:progress", ev)
	})
}

func (a *App) GetSetupProgress() []setup.Dependency {
	return setup.CheckDependencies(a.cfg)
}

func (a *App) RedownloadDependency(id string) error {
	return setup.RunSetup(a.cfg, func(ev setup.ProgressEvent) {
		wailsruntime.EventsEmit(a.ctx, "setup:progress", ev)
	})
}

// === License ===

type LicenseStatus struct {
	Valid  bool   `json:"valid"`
	Serial string `json:"serial"`
}

func devBypassLicense() bool {
	return os.Getenv("DEV_BYPASS_LICENSE") == "1"
}

func (a *App) IsLicenseValid() bool {
	if devBypassLicense() {
		log.Warn().Msg("DEV_BYPASS_LICENSE active — license check skipped (dev only)")
		return true
	}
	serial, err := a.settingsSvc.GetKey("license_serial")
	if err != nil || serial == "" {
		return false
	}
	status, err := license.Validate(serial, a.cfg.License.Salt)
	return err == nil && status.Valid
}

func (a *App) ActivateLicense(serial string) error {
	status, err := license.Validate(serial, a.cfg.License.Salt)
	if err != nil {
		return err
	}
	if !status.Valid {
		return fmt.Errorf("invalid serial number")
	}
	return a.settingsSvc.SetKey("license_serial", serial)
}

func (a *App) GetLicenseStatus() LicenseStatus {
	if devBypassLicense() {
		return LicenseStatus{Valid: true, Serial: "DEV-BYPASS"}
	}
	serial, _ := a.settingsSvc.GetKey("license_serial")
	status, err := license.Validate(serial, a.cfg.License.Salt)
	if err != nil || !status.Valid {
		return LicenseStatus{Valid: false}
	}
	return LicenseStatus{Valid: true, Serial: serial}
}

// === Settings & Providers ===

func (a *App) GetSettings() (*settings.Settings, error) {
	return a.settingsSvc.Get()
}

func (a *App) SaveSettings(s settings.Settings) error {
	return a.settingsSvc.Save(&s)
}

type ProviderStatus struct {
	Connected bool   `json:"connected"`
	Message   string `json:"message"`
}

type Provider struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Primary bool   `json:"primary"`
	Use     string `json:"use"`
	Site    string `json:"site"`
	Status  string `json:"status"` // connected|empty
}

func (a *App) GetProviders() ([]Provider, error) {
	s, err := a.settingsSvc.Get()
	if err != nil {
		return nil, err
	}
	status := func(key string) string {
		if key != "" {
			return "connected"
		}
		return "empty"
	}
	return []Provider{
		{ID: "gemini", Name: "Google Gemini", Primary: true, Use: "analyze", Site: "https://aistudio.google.com", Status: status(s.GeminiAPIKey)},
		{ID: "kie", Name: "Kie.ai", Primary: false, Use: "analyze", Site: "https://kie.ai", Status: status(s.KIEAPIKey)},
		{ID: "openai", Name: "OpenAI", Primary: false, Use: "caption", Site: "https://platform.openai.com", Status: status(s.OpenAIAPIKey)},
	}, nil
}

func (a *App) TestProviderKey(providerID, key string) (ProviderStatus, error) {
	switch providerID {
	case "gemini":
		url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1/models?key=%s", key)
		resp, err := http.Get(url)
		if err != nil {
			return ProviderStatus{false, err.Error()}, nil
		}
		resp.Body.Close()
		if resp.StatusCode == 200 {
			return ProviderStatus{true, "Connected"}, nil
		}
		return ProviderStatus{false, fmt.Sprintf("HTTP %d", resp.StatusCode)}, nil
	case "kie":
		// KIE.ai doesn't have a public ping endpoint; just treat non-empty as ok
		if key != "" {
			return ProviderStatus{true, "Key saved"}, nil
		}
		return ProviderStatus{false, "Empty key"}, nil
	case "openai":
		req, _ := http.NewRequest("GET", "https://api.openai.com/v1/models", nil)
		req.Header.Set("Authorization", "Bearer "+key)
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			return ProviderStatus{false, err.Error()}, nil
		}
		resp.Body.Close()
		if resp.StatusCode == 200 {
			return ProviderStatus{true, "Connected"}, nil
		}
		return ProviderStatus{false, fmt.Sprintf("HTTP %d", resp.StatusCode)}, nil
	default:
		return ProviderStatus{false, "Unknown provider"}, nil
	}
}

type UpdateInfo struct {
	Current   string `json:"current"`
	Latest    string `json:"latest"`
	Available bool   `json:"available"`
}

func (a *App) CheckUpdate() (UpdateInfo, error) {
	current := a.GetAppVersion()
	// For MVP, just return current version with no update available.
	return UpdateInfo{Current: current, Latest: current, Available: false}, nil
}

// === Projects / Thread ===

// analyzeKey returns the API key used for LLM clip analysis. The worker's
// /analyze endpoint targets base_url=api.kie.ai, so the KIE key is preferred;
// the Gemini key is used as a fallback when KIE is not configured.
func analyzeKey(s *settings.Settings) string {
	if s.KIEAPIKey != "" {
		return s.KIEAPIKey
	}
	return s.GeminiAPIKey
}

// StartDownloadResult tells the frontend whether a brand-new download started
// or the video already exists (so it can route the user to the Library to make
// a new clip set instead of re-downloading).
type StartDownloadResult struct {
	ProjectID   string `json:"project_id"`
	VideoExists bool   `json:"video_exists"`
	VideoID     string `json:"video_id"`
	VideoTitle  string `json:"video_title"`
}

func (a *App) StartDownload(url string) (StartDownloadResult, error) {
	s, err := a.settingsSvc.Get()
	if err != nil {
		return StartDownloadResult{}, err
	}
	if analyzeKey(s) == "" {
		return StartDownloadResult{}, fmt.Errorf("API key belum diatur — buka Pengaturan → API Keys dan isi KIE.ai atau Gemini key")
	}

	p, v, exists, err := a.projectSvc.Create(url)
	if err != nil {
		return StartDownloadResult{}, err
	}
	if exists {
		// Video already downloaded — don't re-run the pipeline. Caller shows a
		// toast and sends the user to the Library to make a new clip set.
		return StartDownloadResult{VideoExists: true, VideoID: v.ID, VideoTitle: v.Title}, nil
	}

	go func() {
		ctx := context.Background()
		if err := a.orchestrator.RunDownloadAndAnalyze(ctx, p.ID, v.ID, url, analyzeKey(s)); err != nil {
			log.Error().Err(err).Str("project_id", p.ID).Msg("Download pipeline failed")
		}
	}()

	return StartDownloadResult{ProjectID: p.ID, VideoID: v.ID}, nil
}

func (a *App) ListProjects() ([]project.Project, error) {
	return a.projectSvc.List()
}

func (a *App) GetProject(id string) (*project.Project, error) {
	return a.projectSvc.GetByID(id)
}

// videoForProject loads the source video backing a project. Most bindings need
// source fields (path, transcript, title) which now live on the video.
func (a *App) videoForProject(projectID string) (*video.Video, error) {
	p, err := a.projectSvc.GetByID(projectID)
	if err != nil {
		return nil, err
	}
	return a.videoRepo.GetByID(p.SourceVideoID)
}

func (a *App) DeleteProject(id string) error {
	return a.projectSvc.Delete(id)
}

func (a *App) RetryStep(projectID, step string) error {
	p, err := a.projectSvc.GetByID(projectID)
	if err != nil {
		return err
	}
	v, err := a.videoRepo.GetByID(p.SourceVideoID)
	if err != nil {
		return err
	}
	s, err := a.settingsSvc.Get()
	if err != nil {
		return err
	}
	go func() {
		ctx := context.Background()
		a.orchestrator.RunDownloadAndAnalyze(ctx, p.ID, v.ID, v.YoutubeURL, analyzeKey(s))
	}()
	return nil
}

type ThreadStep struct {
	Role string         `json:"role"` // "you" | "system"
	Kind string         `json:"kind"` // command | info | done | live | error
	Text string         `json:"text"`
	Meta map[string]any `json:"meta"`
	Time string         `json:"time"`
}

type CommandResult struct {
	Intent      string `json:"intent"` // download|generate|unknown
	ProjectID   string `json:"project_id"`
	VideoExists bool   `json:"video_exists"`
	VideoID     string `json:"video_id"`
}

var ytURLPattern = regexp.MustCompile(`https?://(?:www\.)?(?:youtube\.com/watch\?|youtu\.be/)`)

func (a *App) RunCommand(projectID, text string) (CommandResult, error) {
	text = strings.TrimSpace(text)

	if ytURLPattern.MatchString(text) {
		// Extract just the URL from possibly longer text
		words := strings.Fields(text)
		url := ""
		for _, w := range words {
			if ytURLPattern.MatchString(w) {
				url = w
				break
			}
		}
		if url == "" {
			url = text
		}
		res, err := a.StartDownload(url)
		if err != nil {
			return CommandResult{Intent: "download"}, err
		}
		return CommandResult{
			Intent:      "download",
			ProjectID:   res.ProjectID,
			VideoExists: res.VideoExists,
			VideoID:     res.VideoID,
		}, nil
	}

	lower := strings.ToLower(text)
	if strings.Contains(lower, "generate") || strings.Contains(lower, "buat") {
		if projectID != "" {
			err := a.GenerateClips(projectID, nil)
			return CommandResult{Intent: "generate", ProjectID: projectID}, err
		}
		return CommandResult{Intent: "generate"}, fmt.Errorf("no project selected")
	}

	return CommandResult{Intent: "unknown"}, nil
}

func (a *App) GetThread(projectID string) ([]ThreadStep, error) {
	p, err := a.projectSvc.GetByID(projectID)
	if err != nil {
		return nil, err
	}
	v, err := a.videoRepo.GetByID(p.SourceVideoID)
	if err != nil {
		return nil, err
	}

	var steps []ThreadStep
	steps = append(steps, ThreadStep{
		Role: "system",
		Kind: "info",
		Text: fmt.Sprintf("Project: %s", v.Title),
		Meta: map[string]any{"status": p.Status, "duration": v.Duration},
		Time: p.CreatedAt.Format("15:04"),
	})

	switch p.Status {
	case "done":
		steps = append(steps, ThreadStep{Role: "system", Kind: "done", Text: "Analysis complete, clips ready.", Time: p.UpdatedAt.Format("15:04")})
	case "error":
		steps = append(steps, ThreadStep{Role: "system", Kind: "error", Text: "Processing failed.", Time: p.UpdatedAt.Format("15:04")})
	case "downloading", "transcribing", "analyzing":
		steps = append(steps, ThreadStep{Role: "system", Kind: "live", Text: p.Status + "…", Time: p.UpdatedAt.Format("15:04")})
	}

	return steps, nil
}

// === Clips — Editor / Preview ===

func (a *App) GetClips(projectID string) ([]clip.Clip, error) {
	return a.clipSvc.GetByProject(projectID)
}

func (a *App) UpdateClipTimestamp(clipID string, start, end int) error {
	return a.clipSvc.UpdateTimestamp(clipID, start, end)
}

func (a *App) ToggleClip(clipID string, enabled bool) error {
	return a.clipSvc.SetEnabled(clipID, enabled)
}

func (a *App) AddCustomClip(projectID string, start, end int) (*clip.Clip, error) {
	return a.clipSvc.AddCustom(projectID, start, end)
}

func (a *App) RemoveClip(clipID string) error {
	return a.clipSvc.Delete(clipID)
}

type TranscriptSegment struct {
	Text  string  `json:"text"`
	Start float64 `json:"start"`
	End   float64 `json:"end"`
}

func (a *App) GetTranscriptRange(projectID string, startSec, endSec int) ([]TranscriptSegment, error) {
	v, err := a.videoForProject(projectID)
	if err != nil {
		return nil, err
	}

	var allSegments []pipeline.TranscriptSegment
	if v.TranscriptJSON != "" {
		if err := json.Unmarshal([]byte(v.TranscriptJSON), &allSegments); err != nil {
			return nil, err
		}
	}

	var result []TranscriptSegment
	for _, seg := range allSegments {
		if seg.End >= float64(startSec) && seg.Start <= float64(endSec) {
			result = append(result, TranscriptSegment{
				Text:  seg.Text,
				Start: seg.Start,
				End:   seg.End,
			})
		}
	}
	return result, nil
}

func (a *App) GetVideoPath(projectID string) (string, error) {
	v, err := a.videoForProject(projectID)
	if err != nil {
		return "", err
	}
	return v.VideoPath, nil
}

type FaceFrame struct {
	Frame int     `json:"frame"`
	Time  float64 `json:"time"`
	X     float64 `json:"x"`
	Y     float64 `json:"y"`
	W     float64 `json:"w"`
	H     float64 `json:"h"`
}

type FaceObs struct {
	X    float64 `json:"x"`
	Y    float64 `json:"y"`
	W    float64 `json:"w"`
	H    float64 `json:"h"`
	Conf float64 `json:"conf"`
}

type FaceSampleEntry struct {
	Time  float64   `json:"time"`
	Faces []FaceObs `json:"faces"`
}

type CropPlan struct {
	Ratio     string      `json:"ratio"`
	Keyframes []FaceFrame `json:"keyframes"`
}

type CaptionOpts struct {
	Position string `json:"position"` // top|mid|bot
	Size     string `json:"size"`     // S|M|L
}

type TrackOpts struct {
	Smooth        bool `json:"smooth"`
	LockMain      bool `json:"lock_main"`
	Sensitivity   int  `json:"sensitivity"` // 0..100
	ReserveBottom bool `json:"reserve_bottom"`
}

func (a *App) GetClipWaveform(clipID string) ([]float64, error) {
	c, err := a.clipRepo.GetByID(clipID)
	if err != nil {
		return nil, err
	}
	if c.WaveformPath != "" {
		data, err := os.ReadFile(c.WaveformPath)
		if err == nil {
			var peaks []float64
			if json.Unmarshal(data, &peaks) == nil {
				return peaks, nil
			}
		}
	}

	v, err := a.videoForProject(c.ProjectID)
	if err != nil {
		return nil, err
	}

	resp, err := a.worker.Waveform(context.Background(), pipeline.WaveformRequest{
		AudioPath: v.VideoPath,
		Start:     c.StartSeconds,
		End:       c.EndSeconds,
		Samples:   200,
	})
	if err != nil {
		return nil, err
	}

	outDir := filepath.Join(a.cfg.Paths.DataDir, "clips", clipID)
	os.MkdirAll(outDir, 0755)
	wfPath := filepath.Join(outDir, "waveform.json")
	if data, err := json.Marshal(resp.Peaks); err == nil {
		os.WriteFile(wfPath, data, 0644)
		a.clipRepo.SetWaveformPath(clipID, wfPath)
		fi, _ := os.Stat(wfPath)
		if fi != nil {
			a.assetRepo.Create(&asset.Asset{
				ClipID:    clipID,
				ProjectID: c.ProjectID,
				Kind:      asset.KindWaveform,
				Path:      wfPath,
				SizeBytes: fi.Size(),
			})
		}
	}

	return resp.Peaks, nil
}

func (a *App) GetClipThumbnails(clipID string, n int) ([]string, error) {
	c, err := a.clipRepo.GetByID(clipID)
	if err != nil {
		return nil, err
	}
	v, err := a.videoForProject(c.ProjectID)
	if err != nil {
		return nil, err
	}

	outDir := filepath.Join(a.cfg.Paths.DataDir, "clips", clipID, "thumbs")
	os.MkdirAll(outDir, 0755)

	resp, err := a.worker.Thumbnails(context.Background(), pipeline.ThumbnailsRequest{
		VideoPath: v.VideoPath,
		Start:     c.StartSeconds,
		End:       c.EndSeconds,
		Count:     n,
		OutDir:    outDir,
	})
	if err != nil {
		return nil, err
	}

	for _, path := range resp.Paths {
		fi, _ := os.Stat(path)
		sz := int64(0)
		if fi != nil {
			sz = fi.Size()
		}
		a.assetRepo.Create(&asset.Asset{
			ClipID:    clipID,
			ProjectID: c.ProjectID,
			Kind:      asset.KindThumbnail,
			Path:      path,
			SizeBytes: sz,
		})
	}

	return resp.Paths, nil
}

func (a *App) GetFaceTrack(clipID string) ([]FaceFrame, error) {
	c, err := a.clipRepo.GetByID(clipID)
	if err != nil {
		return nil, err
	}
	v, err := a.videoForProject(c.ProjectID)
	if err != nil {
		return nil, err
	}

	resp, err := a.worker.Facetrack(context.Background(), pipeline.FacetrackRequest{
		VideoPath: v.VideoPath,
		Start:     c.StartSeconds,
		End:       c.EndSeconds,
	})
	if err != nil {
		return nil, err
	}

	var frames []FaceFrame
	for _, f := range resp.Frames {
		frames = append(frames, FaceFrame{Frame: f.Frame, Time: f.Time, X: f.X, Y: f.Y, W: f.W, H: f.H})
	}
	return frames, nil
}

func (a *App) GetClipFaces(clipID string) ([]FaceSampleEntry, error) {
	c, err := a.clipRepo.GetByID(clipID)
	if err != nil {
		return nil, err
	}
	if c.FaceDataJSON == "" {
		return []FaceSampleEntry{}, nil
	}
	// face_data_json shape: [{"timestamp": float, "faces": [{"x","y","w","h","conf" PIXELS}]}]
	type rawFace struct {
		X    float64 `json:"x"`
		Y    float64 `json:"y"`
		W    float64 `json:"w"`
		H    float64 `json:"h"`
		Conf float64 `json:"conf"`
	}
	type rawSample struct {
		Timestamp float64   `json:"timestamp"`
		Faces     []rawFace `json:"faces"`
	}
	var raw []rawSample
	if err := json.Unmarshal([]byte(c.FaceDataJSON), &raw); err != nil {
		return []FaceSampleEntry{}, nil
	}
	result := make([]FaceSampleEntry, 0, len(raw))
	for _, s := range raw {
		entry := FaceSampleEntry{Time: s.Timestamp}
		for _, f := range s.Faces {
			entry.Faces = append(entry.Faces, FaceObs{X: f.X, Y: f.Y, W: f.W, H: f.H, Conf: f.Conf})
		}
		result = append(result, entry)
	}
	return result, nil
}

func (a *App) PreviewReframe(clipID, ratio string) (CropPlan, error) {
	frames, err := a.GetFaceTrack(clipID)
	if err != nil {
		return CropPlan{}, err
	}
	return CropPlan{Ratio: ratio, Keyframes: frames}, nil
}

func (a *App) SetClipAspectRatio(clipID, ratio string) error {
	return a.clipSvc.SetAspectRatio(clipID, ratio)
}

func (a *App) SetClipCaptionStyle(clipID, styleID string) error {
	return a.clipSvc.SetCaptionStyle(clipID, styleID)
}

func (a *App) SetClipCaptionOpts(clipID string, opts CaptionOpts) error {
	return a.clipSvc.SetCaptionOpts(clipID, opts.Position, opts.Size)
}

func (a *App) SaveCaption(clipID, text string) error {
	return a.clipSvc.SetCaptionText(clipID, text)
}

func (a *App) RegenerateCaption(clipID string) (string, error) {
	c, err := a.clipRepo.GetByID(clipID)
	if err != nil {
		return "", err
	}
	s, err := a.settingsSvc.Get()
	if err != nil {
		return "", err
	}
	key := analyzeKey(s)
	if key == "" {
		return "", fmt.Errorf("API key belum diatur — buka Pengaturan → API Keys")
	}
	resp, err := a.worker.GenerateCaption(context.Background(), pipeline.CaptionRequest{
		TranscriptExcerpt: c.TranscriptExcerpt,
		Lang:              s.TranscriptLanguage,
		APIKey:            key,
		Model:             a.cfg.Gemini.Model,
		BaseURL:           a.cfg.Gemini.BaseURL,
	})
	if err != nil {
		return "", err
	}
	a.clipSvc.SetCaptionText(clipID, resp.Caption)
	return resp.Caption, nil
}

// RegenerateSubtitle membangun ulang file subtitle .ass yang ber-timing per kata
// (start/end menit:detik) untuk satu clip, MURNI dari transkrip audio lokal lewat
// faster-whisper (lite) — TANPA prompt ke Gemini. Ini berbeda dari RegenerateCaption
// yang membuat satu caption statis via LLM.
//
// Jalur: Cut (audio segmen clip) → WhisperAlign (word timestamps) → GenerateSubtitle
// (words → ASS karaoke). Hanya subtitle_path yang di-update; clip final TIDAK
// di-render ulang — render terbaru terjadi saat user generate/export berikutnya.
func (a *App) RegenerateSubtitle(clipID string) (string, error) {
	c, err := a.clipSvc.GetByID(clipID)
	if err != nil {
		return "", err
	}
	v, err := a.videoForProject(c.ProjectID)
	if err != nil {
		return "", err
	}

	outDir := filepath.Join(a.cfg.Paths.DataDir, "clips", clipID)
	if err := os.MkdirAll(outDir, 0755); err != nil {
		return "", err
	}

	// Reuse potongan clip yang sudah ada; kalau belum, cut dulu dari video sumber.
	clipPath := c.RawClipPath
	if clipPath == "" {
		cutResp, err := a.worker.Cut(context.Background(), pipeline.CutRequest{
			VideoPath: v.VideoPath,
			ClipID:    clipID,
			Start:     c.StartSeconds,
			End:       c.EndSeconds,
			OutDir:    outDir,
		})
		if err != nil {
			return "", fmt.Errorf("cut: %w", err)
		}
		clipPath = cutResp.ClipPath
	}

	// Whisper "lite": pakai Preview.WhisperModel (mis. tiny) bila diset, fallback "tiny".
	whisperModel := a.cfg.Preview.WhisperModel
	if whisperModel == "" {
		whisperModel = "tiny"
	}
	whisperResp, err := a.worker.WhisperAlign(context.Background(), pipeline.WhisperRequest{
		AudioPath: clipPath,
		Language:  a.cfg.Processing.TranscriptLanguage,
		ModelSize: whisperModel,
	})
	if err != nil {
		return "", fmt.Errorf("whisper: %w", err)
	}

	splitMode := c.TrackTemplate == "dual" || c.TrackTemplate == "dual_side"
	subResp, err := a.worker.GenerateSubtitle(context.Background(), pipeline.SubtitleRequest{
		Words:    whisperResp.Words,
		Style:    c.CaptionStyle,
		Position: c.CaptionPosition,
		Size:     c.CaptionSize,
		// CaptionText sengaja dikosongkan: kita ingin subtitle ber-timing per kata,
		// bukan satu blok caption statis.
		ClipDuration: float64(c.EndSeconds - c.StartSeconds),
		OutDir:       outDir,
		ClipID:       clipID,
		SplitMode:    splitMode,
	})
	if err != nil {
		return "", fmt.Errorf("subtitle: %w", err)
	}

	if err := a.clipRepo.UpdateField(clipID, "subtitle_path", subResp.ASSPath); err != nil {
		return "", err
	}
	return subResp.ASSPath, nil
}

func (a *App) SetClipTrackTemplate(clipID, templateID string) error {
	return a.clipSvc.SetTrackTemplate(clipID, templateID)
}

func (a *App) SetClipTrackOpts(clipID string, opts TrackOpts) error {
	return a.clipSvc.SetTrackOpts(clipID, opts.Smooth, opts.LockMain, opts.Sensitivity, opts.ReserveBottom)
}

func (a *App) RetrackFaces(clipID string) error {
	_, err := a.GetFaceTrack(clipID)
	return err
}

// === Generate / Export ===

func (a *App) GenerateClips(projectID string, clipIDs []string) error {
	v, err := a.videoForProject(projectID)
	if err != nil {
		return err
	}

	allClips, err := a.clipSvc.GetByProject(projectID)
	if err != nil {
		return err
	}

	var toGenerate []clip.Clip
	if len(clipIDs) == 0 {
		toGenerate = allClips
	} else {
		idSet := map[string]bool{}
		for _, id := range clipIDs {
			idSet[id] = true
		}
		for _, c := range allClips {
			if idSet[c.ID] {
				toGenerate = append(toGenerate, c)
			}
		}
	}

	go a.generator.GenerateAll(context.Background(), projectID, v.VideoPath, toGenerate)
	return nil
}

func (a *App) CancelGeneration(projectID string) error {
	return a.generator.Cancel(projectID)
}

// GeneratePreview renders fast draft clips (whisper tiny + static crop) for the given project.
func (a *App) GeneratePreview(projectID string) error {
	v, err := a.videoForProject(projectID)
	if err != nil {
		return err
	}
	if v.VideoPath == "" {
		return fmt.Errorf("video not downloaded yet")
	}
	allClips, err := a.clipSvc.GetByProject(projectID)
	if err != nil {
		return err
	}
	go a.generator.GeneratePreview(context.Background(), projectID, v.VideoPath, allClips)
	return nil
}

// ConfigureWorker sends tuning config from config.yaml to the worker process.
// Call this once after the worker health check passes.
func (a *App) ConfigureWorker() error {
	v := a.cfg.Video
	req := pipeline.WorkerTuningConfig{
		DataDir: a.cfg.Paths.DataDir,
	}
	if v.Encoder != "" {
		req.Encoder = v.Encoder
	}
	if v.Bitrate != "" {
		req.Bitrate = v.Bitrate
	}
	if v.DeadzoneRatio > 0 {
		req.DeadzoneRatio = v.DeadzoneRatio
	}
	if v.MaxSpeedPxPerSec > 0 {
		req.MaxSpeedPxPerSec = v.MaxSpeedPxPerSec
	}
	if v.SmoothingTauSec > 0 {
		req.SmoothingTauSec = v.SmoothingTauSec
	}
	if v.SceneCutScore > 0 {
		req.SceneCutScore = v.SceneCutScore
	}
	if v.SceneCutHist > 0 {
		req.SceneCutHist = v.SceneCutHist
	}
	if v.SceneCutPixel > 0 {
		req.SceneCutPixel = v.SceneCutPixel
	}
	resp, err := a.worker.Configure(context.Background(), req)
	if err != nil {
		return fmt.Errorf("configure worker: %w", err)
	}
	log.Info().Strs("applied", resp.Applied).Msg("Worker configured")
	return nil
}

func (a *App) RetryClip(clipID string) error {
	c, err := a.clipSvc.GetByID(clipID)
	if err != nil {
		return err
	}
	v, err := a.videoForProject(c.ProjectID)
	if err != nil {
		return err
	}
	go a.generator.GenerateAll(context.Background(), c.ProjectID, v.VideoPath, []clip.Clip{*c})
	return nil
}

func (a *App) GetClipOutputPath(clipID string) (string, error) {
	c, err := a.clipSvc.GetByID(clipID)
	if err != nil {
		return "", err
	}
	return c.FinalClipPath, nil
}

type ExportOpts struct {
	Ratio  string `json:"ratio"`
	Burn   bool   `json:"burn"`
	Codec  string `json:"codec"`
	OutDir string `json:"out_dir"`
}

func (a *App) ExportClips(clipIDs []string, opts ExportOpts) error {
	if opts.OutDir == "" {
		s, err := a.settingsSvc.Get()
		if err != nil {
			return err
		}
		opts.OutDir = s.OutputDir
	}
	if opts.Codec == "" {
		opts.Codec = "h264"
	}
	os.MkdirAll(opts.OutDir, 0755)

	go func() {
		for i, clipID := range clipIDs {
			c, err := a.clipRepo.GetByID(clipID)
			if err != nil {
				wailsruntime.EventsEmit(a.ctx, "export:progress", map[string]interface{}{
					"clip_id": clipID, "stage": "error", "percent": 0,
				})
				continue
			}

			wailsruntime.EventsEmit(a.ctx, "export:progress", map[string]interface{}{
				"clip_id": clipID, "stage": "copying", "percent": float64(i) / float64(len(clipIDs)) * 100,
			})

			dst := filepath.Join(opts.OutDir, filepath.Base(c.FinalClipPath))
			copyFile(c.FinalClipPath, dst)
		}
		wailsruntime.EventsEmit(a.ctx, "export:complete", map[string]interface{}{
			"out_dir": opts.OutDir, "count": len(clipIDs),
		})
	}()

	return nil
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()
	_, err = io.Copy(out, in)
	return err
}

// === Gallery & Storage ===

func (a *App) GetGallery() ([]clip.GalleryItem, error) {
	return a.clipSvc.GetGallery()
}

func (a *App) DownloadAllAsZip(projectID string) (string, error) {
	clips, err := a.clipSvc.GetByProject(projectID)
	if err != nil {
		return "", err
	}

	zipPath := filepath.Join(a.cfg.Paths.OutputDir, projectID+"-clips.zip")
	zf, err := os.Create(zipPath)
	if err != nil {
		return "", err
	}
	defer zf.Close()

	zw := zip.NewWriter(zf)
	defer zw.Close()

	for _, c := range clips {
		if c.FinalClipPath == "" {
			continue
		}
		f, err := os.Open(c.FinalClipPath)
		if err != nil {
			continue
		}
		w, err := zw.Create(filepath.Base(c.FinalClipPath))
		if err != nil {
			f.Close()
			continue
		}
		io.Copy(w, f)
		f.Close()
	}

	return zipPath, nil
}

type StorageCat struct {
	Key       string `json:"key"`
	Label     string `json:"label"`
	Color     string `json:"color"`
	SizeBytes int64  `json:"size_bytes"`
}

type VideoUsage struct {
	ProjectID   string `json:"project_id"`
	Title       string `json:"title"`
	Channel     string `json:"channel"`
	Clips       int    `json:"clips"`
	SourceBytes int64  `json:"source_bytes"`
	OutputBytes int64  `json:"output_bytes"`
	MetaBytes   int64  `json:"meta_bytes"`
}

type Storage struct {
	LimitGB    float64      `json:"limit_gb"`
	Categories []StorageCat `json:"categories"`
	PerVideo   []VideoUsage `json:"per_video"`
}

func (a *App) GetStorageBreakdown() (Storage, error) {
	s, err := a.settingsSvc.Get()
	if err != nil {
		return Storage{}, err
	}

	videos, err := a.videoRepo.List()
	if err != nil {
		return Storage{}, err
	}

	var sourceTotal, outputTotal, metaTotal int64
	var perVideo []VideoUsage

	for _, vid := range videos {
		// Output clips: aggregate across every project derived from this video.
		projects, _ := a.projectRepo.ListByVideo(vid.ID)
		var outputBytes, clipCount int64
		var metaBytes int64 = int64(len(vid.TranscriptJSON))
		for _, p := range projects {
			metaBytes += int64(len(p.GeminiJSON))
			clips, _ := a.clipRepo.GetByProject(p.ID)
			clipCount += int64(len(clips))
			for _, c := range clips {
				if c.FinalClipPath != "" {
					fi, _ := os.Stat(c.FinalClipPath)
					if fi != nil {
						outputBytes += fi.Size()
					}
				}
			}
		}

		sourceTotal += vid.SourceBytes
		outputTotal += outputBytes
		metaTotal += metaBytes

		perVideo = append(perVideo, VideoUsage{
			ProjectID:   vid.ID,
			Title:       vid.Title,
			Channel:     vid.Channel,
			Clips:       int(clipCount),
			SourceBytes: vid.SourceBytes,
			OutputBytes: outputBytes,
			MetaBytes:   metaBytes,
		})
	}

	cacheBytes, _ := a.assetRepo.TotalCacheBytes()

	return Storage{
		LimitGB: s.StorageLimitGB,
		Categories: []StorageCat{
			{Key: "source", Label: "Source Videos", Color: "#7C3AED", SizeBytes: sourceTotal},
			{Key: "output", Label: "Output Clips", Color: "#10B981", SizeBytes: outputTotal},
			{Key: "meta", Label: "Metadata", Color: "#F59E0B", SizeBytes: metaTotal},
			{Key: "cache", Label: "Cache", Color: "#6B7280", SizeBytes: cacheBytes},
		},
		PerVideo: perVideo,
	}, nil
}

type DeletePreview struct {
	Clips          int   `json:"clips"`
	Videos         int   `json:"videos"`
	SourceBytes    int64 `json:"source_bytes"`
	OutputBytes    int64 `json:"output_bytes"`
	MetaBytes      int64 `json:"meta_bytes"`
	TotalBytes     int64 `json:"total_bytes"`
	AfterUsedBytes int64 `json:"after_used_bytes"`
}

func (a *App) GetDeletePreview(clipIDs []string) (DeletePreview, error) {
	clips, err := a.clipRepo.GetByIDs(clipIDs)
	if err != nil {
		return DeletePreview{}, err
	}
	var outputBytes int64
	for _, c := range clips {
		if c.FinalClipPath != "" {
			fi, _ := os.Stat(c.FinalClipPath)
			if fi != nil {
				outputBytes += fi.Size()
			}
		}
	}
	storage, err := a.GetStorageBreakdown()
	if err != nil {
		return DeletePreview{}, err
	}
	var usedBytes int64
	for _, cat := range storage.Categories {
		usedBytes += cat.SizeBytes
	}
	return DeletePreview{
		Clips:          len(clips),
		OutputBytes:    outputBytes,
		TotalBytes:     outputBytes,
		AfterUsedBytes: usedBytes - outputBytes,
	}, nil
}

func (a *App) DeleteClips(clipIDs []string) error {
	clips, err := a.clipRepo.GetByIDs(clipIDs)
	if err != nil {
		return err
	}
	for _, c := range clips {
		if c.FinalClipPath != "" {
			os.Remove(c.FinalClipPath)
		}
		if c.SubtitlePath != "" {
			os.Remove(c.SubtitlePath)
		}
		a.assetRepo.DeleteByClip(c.ID)
	}
	return a.clipRepo.DeleteByIDs(clipIDs)
}

func (a *App) DeleteVideos(projectIDs []string) error {
	for _, pid := range projectIDs {
		p, err := a.projectSvc.GetByID(pid)
		if err != nil {
			continue
		}
		clips, _ := a.clipRepo.GetByProject(pid)
		for _, c := range clips {
			if c.FinalClipPath != "" {
				os.Remove(c.FinalClipPath)
			}
			if c.SubtitlePath != "" {
				os.Remove(c.SubtitlePath)
			}
			a.assetRepo.DeleteByClip(c.ID)
		}
		a.projectRepo.Delete(pid)

		// If this was the video's last project, remove the source video too.
		if siblings, _ := a.projectRepo.ListByVideo(p.SourceVideoID); len(siblings) == 0 {
			if v, err := a.videoRepo.GetByID(p.SourceVideoID); err == nil && v.VideoPath != "" {
				os.Remove(v.VideoPath)
			}
			a.videoRepo.Delete(p.SourceVideoID)
		}
	}
	return nil
}

func (a *App) ClearCache() (int64, error) {
	return a.assetRepo.DeleteAll()
}

func (a *App) DeleteAllSource() (int64, error) {
	videos, err := a.videoRepo.List()
	if err != nil {
		return 0, err
	}
	var freed int64
	for _, v := range videos {
		if v.VideoPath != "" {
			fi, _ := os.Stat(v.VideoPath)
			if fi != nil {
				freed += fi.Size()
			}
			os.Remove(v.VideoPath)
			a.videoRepo.UpdateField(v.ID, "video_path", "")
			a.videoRepo.UpdateField(v.ID, "source_bytes", 0)
		}
	}
	return freed, nil
}

// === Library ===

type LibraryVideo struct {
	VideoID      string `json:"video_id"`
	Title        string `json:"title"`
	YoutubeURL   string `json:"youtube_url"`
	Duration     int    `json:"duration"`
	SourceBytes  int64  `json:"source_bytes"`
	VideoPath    string `json:"video_path"`
	FileExists   bool   `json:"file_exists"`
	Status       string `json:"status"`
	ThumbPath    string `json:"thumb_path"`
	ClipCount    int    `json:"clip_count"`
	ProjectCount int    `json:"project_count"`
	CreatedAt    string `json:"created_at"`
}

func (a *App) ListLibraryVideos() ([]LibraryVideo, error) {
	videos, err := a.videoRepo.List()
	if err != nil {
		return nil, err
	}

	var result []LibraryVideo
	for _, v := range videos {
		if v.IsLocal {
			continue
		}

		// Aggregate clips + find a thumbnail across all projects of this video.
		projects, _ := a.projectRepo.ListByVideo(v.ID)
		clipCount := 0
		thumbPath := ""
		for _, p := range projects {
			clips, _ := a.clipRepo.GetByProject(p.ID)
			clipCount += len(clips)
			if thumbPath == "" {
				for _, c := range clips {
					assets, _ := a.assetRepo.GetByClip(c.ID)
					for _, asset := range assets {
						if asset.Kind == "thumbnail" {
							thumbPath = asset.Path
							break
						}
					}
					if thumbPath != "" {
						break
					}
				}
			}
		}

		// Check file exists live
		fileExists := false
		sourceBytes := v.SourceBytes
		if v.VideoPath != "" {
			fi, err := os.Stat(v.VideoPath)
			if err == nil {
				fileExists = true
				if sourceBytes == 0 {
					sourceBytes = fi.Size()
				}
			}
		}

		result = append(result, LibraryVideo{
			VideoID:      v.ID,
			Title:        v.Title,
			YoutubeURL:   v.YoutubeURL,
			Duration:     v.Duration,
			SourceBytes:  sourceBytes,
			VideoPath:    v.VideoPath,
			FileExists:   fileExists,
			Status:       v.Status,
			ThumbPath:    thumbPath,
			ClipCount:    clipCount,
			ProjectCount: len(projects),
			CreatedAt:    v.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		})
	}
	return result, nil
}

// DeleteSourceVideo removes the on-disk source file for a video (keeps DB rows).
func (a *App) DeleteSourceVideo(videoID string) error {
	v, err := a.videoRepo.GetByID(videoID)
	if err != nil {
		return err
	}
	if v.VideoPath != "" {
		os.Remove(v.VideoPath)
		a.videoRepo.UpdateField(videoID, "video_path", "")
		a.videoRepo.UpdateField(videoID, "source_bytes", 0)
	}
	wailsruntime.EventsEmit(a.ctx, "library:source_deleted", map[string]string{"video_id": videoID})
	return nil
}

// === Video → Projects (Library detail) ===

// ListVideos returns all downloaded source videos (for the Library grid).
func (a *App) ListVideos() ([]video.Video, error) {
	return a.videoRepo.List()
}

// GetVideo returns a single source video.
func (a *App) GetVideo(videoID string) (*video.Video, error) {
	return a.videoRepo.GetByID(videoID)
}

// ListProjectsByVideo returns all clip-set projects derived from a video.
func (a *App) ListProjectsByVideo(videoID string) ([]project.Project, error) {
	return a.projectSvc.ListByVideo(videoID)
}

// MakeMoreClips creates a NEW project for an already-downloaded video and runs
// AI analysis on it, excluding moments already used by the video's other
// projects. Returns the new project id. This replaces the old per-project
// "find more clips" with a clean 1-video-many-projects flow.
func (a *App) MakeMoreClips(videoID string) (string, error) {
	v, err := a.videoRepo.GetByID(videoID)
	if err != nil {
		return "", err
	}
	if v.TranscriptJSON == "" && v.VideoID == "" {
		return "", fmt.Errorf("tidak ada transkrip yang tersimpan untuk video ini")
	}
	s, err := a.settingsSvc.Get()
	if err != nil {
		return "", err
	}
	apiKey := analyzeKey(s)
	if apiKey == "" {
		return "", fmt.Errorf("API key belum diatur — buka Pengaturan → API Keys")
	}

	// Exclude moments already used across every existing project of this video.
	siblings, _ := a.projectSvc.ListByVideo(videoID)
	var excludeClips []pipeline.ExcludeClip
	for _, sp := range siblings {
		clips, _ := a.clipRepo.GetByProject(sp.ID)
		for _, c := range clips {
			excludeClips = append(excludeClips, pipeline.ExcludeClip{
				StartSeconds: c.StartSeconds,
				EndSeconds:   c.EndSeconds,
				Summary:      c.Summary,
			})
		}
	}

	name := fmt.Sprintf("%s — set %d", v.Title, len(siblings)+1)
	p, err := a.projectSvc.CreateForVideo(videoID, name)
	if err != nil {
		return "", err
	}

	go func() {
		ctx := context.Background()
		if err := a.orchestrator.RunAnalyzeOnly(ctx, p.ID, apiKey, excludeClips); err != nil {
			log.Error().Err(err).Str("project_id", p.ID).Msg("MakeMoreClips failed")
		}
	}()
	return p.ID, nil
}

func (a *App) FindMoreClips(projectID string) error {
	p, err := a.projectSvc.GetByID(projectID)
	if err != nil {
		return err
	}
	v, err := a.videoRepo.GetByID(p.SourceVideoID)
	if err != nil {
		return err
	}
	if p.Status != "ready" && p.Status != "error" {
		return fmt.Errorf("project sedang diproses, coba lagi setelah selesai")
	}
	if v.TranscriptJSON == "" && v.VideoID == "" {
		return fmt.Errorf("tidak ada transkrip yang tersimpan untuk video ini")
	}

	s, err := a.settingsSvc.Get()
	if err != nil {
		return err
	}
	apiKey := analyzeKey(s)
	if apiKey == "" {
		return fmt.Errorf("API key belum diatur — buka Pengaturan → API Keys")
	}

	// Build exclude list from existing clips
	existingClips, err := a.clipRepo.GetByProject(projectID)
	if err != nil {
		return err
	}
	excludeClips := make([]pipeline.ExcludeClip, 0, len(existingClips))
	for _, c := range existingClips {
		excludeClips = append(excludeClips, pipeline.ExcludeClip{
			StartSeconds: c.StartSeconds,
			EndSeconds:   c.EndSeconds,
			Summary:      c.Summary,
		})
	}

	go func() {
		ctx := context.Background()
		if err := a.orchestrator.RunAnalyzeOnly(ctx, projectID, apiKey, excludeClips); err != nil {
			log.Error().Err(err).Str("project_id", projectID).Msg("FindMoreClips failed")
		}
	}()

	return nil
}

func (a *App) RedownloadSource(videoID string) error {
	v, err := a.videoRepo.GetByID(videoID)
	if err != nil {
		return err
	}
	if v.YoutubeURL == "" {
		return fmt.Errorf("video tidak punya YouTube URL")
	}

	go func() {
		ctx := context.Background()
		emitLog := func(tool, level, msg string) {
			wailsruntime.EventsEmit(a.ctx, "worker:log", pipeline.LogEvent{
				T:         time.Now().Format(time.RFC3339),
				Tool:      tool,
				Level:     level,
				M:         msg,
				ProjectID: videoID,
			})
		}
		emit := func(step string, pct float64, msg string) {
			wailsruntime.EventsEmit(a.ctx, "download:progress", pipeline.ProgressEvent{
				ProjectID: videoID,
				Step:      step,
				Percent:   pct,
				Message:   msg,
			})
			emitLog("youtube", "info", msg)
		}

		emit("download", 5, "Mengunduh ulang video…")
		a.videoRepo.UpdateStatus(videoID, "downloading")

		dlResp, err := a.worker.Download(ctx, pipeline.DownloadRequest{
			URL:     v.YoutubeURL,
			VideoID: v.VideoID,
			OutDir:  filepath.Join(a.cfg.Paths.DataDir, "videos"),
		}, func(pct float64, msg string) {
			overall := 5 + pct*0.9
			emit("download", overall, msg)
		}, func(line string) {
			emitLog("youtube", pipeline.InferLevel(line), line)
		})
		if err != nil {
			emitLog("youtube", "err", err.Error())
			wailsruntime.EventsEmit(a.ctx, "download:error", map[string]string{
				"video_id": videoID, "step": "download", "error": err.Error(),
			})
			a.videoRepo.UpdateStatus(videoID, "error")
			return
		}

		a.videoRepo.UpdateField(videoID, "video_path", dlResp.VideoPath)
		fi, err := os.Stat(dlResp.VideoPath)
		if err == nil {
			a.videoRepo.UpdateField(videoID, "source_bytes", fi.Size())
		}
		a.videoRepo.UpdateStatus(videoID, "ready")
		wailsruntime.EventsEmit(a.ctx, "download:complete", map[string]string{"video_id": videoID})
	}()

	return nil
}

// === Utility ===

func (a *App) OpenFolder(path string) error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", path)
	case "windows":
		cmd = exec.Command("explorer", path)
	default:
		cmd = exec.Command("xdg-open", path)
	}
	return cmd.Start()
}

func (a *App) GetAppVersion() string {
	return "1.0.0"
}

func (a *App) OnFileDrop(paths []string) {
	for _, p := range paths {
		ext := strings.ToLower(filepath.Ext(p))
		if ext != ".mp4" && ext != ".mov" && ext != ".mkv" && ext != ".avi" {
			continue
		}
		proj, vid, err := a.projectSvc.CreateFromFile(p)
		if err != nil {
			log.Error().Err(err).Str("path", p).Msg("File drop project creation failed")
			continue
		}
		fi, _ := os.Stat(p)
		if fi != nil {
			a.videoRepo.UpdateField(vid.ID, "source_bytes", fi.Size())
		}
		wailsruntime.EventsEmit(a.ctx, "thread:step", ThreadStep{
			Role: "system",
			Kind: "info",
			Text: fmt.Sprintf("Local file added: %s", filepath.Base(p)),
			Meta: map[string]any{"project_id": proj.ID},
			Time: proj.CreatedAt.Format("15:04"),
		})
	}
}

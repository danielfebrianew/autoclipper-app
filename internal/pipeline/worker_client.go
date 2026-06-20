package pipeline

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type WorkerClient struct {
	baseURL    string
	httpClient *http.Client
}

func NewWorkerClient(host string, port int) *WorkerClient {
	return &WorkerClient{
		baseURL: fmt.Sprintf("http://%s:%d", host, port),
		httpClient: &http.Client{
			Timeout: 10 * time.Minute,
		},
	}
}

func (c *WorkerClient) post(ctx context.Context, path string, body, result interface{}) error {
	payload, err := json.Marshal(body)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		c.baseURL+path, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("worker request failed: %w", err)
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	if resp.StatusCode >= 400 {
		return fmt.Errorf("worker error %d: %s", resp.StatusCode, data)
	}

	if result != nil {
		return json.Unmarshal(data, result)
	}
	return nil
}

// --- Request / Response types ---

type MetadataRequest struct {
	URL string `json:"url"`
}

type MetadataResponse struct {
	Title       string      `json:"title"`
	Channel     string      `json:"channel"`
	Duration    int         `json:"duration"`
	Views       int         `json:"views"`
	VideoID     string      `json:"video_id"`
	HeatmapJSON interface{} `json:"heatmap"`
}

type DownloadRequest struct {
	URL     string `json:"url"`
	VideoID string `json:"video_id"`
	OutDir  string `json:"out_dir"`
}

type DownloadResponse struct {
	VideoPath string `json:"video_path"`
}

type TranscriptRequest struct {
	VideoID  string `json:"video_id"`
	Language string `json:"language"`
}

type TranscriptResponse struct {
	Segments []TranscriptSegment `json:"segments"`
}

type TranscriptSegment struct {
	Text     string  `json:"text"`
	Start    float64 `json:"start"`
	End      float64 `json:"end"`
	Duration float64 `json:"duration"`
}

type ExcludeClip struct {
	StartSeconds int    `json:"start_seconds"`
	EndSeconds   int    `json:"end_seconds"`
	Summary      string `json:"summary"`
}

type AnalyzeRequest struct {
	Transcript           string            `json:"transcript"`
	HeatmapText          string            `json:"heatmap_text"`
	Title                string            `json:"title"`
	Channel              string            `json:"channel"`
	Duration             int               `json:"duration"`
	APIKey               string            `json:"api_key"`
	Model                string            `json:"model"`
	BaseURL              string            `json:"base_url"`
	MaxClips             int               `json:"max_clips"`
	MinDuration          int               `json:"min_duration"`
	MaxDuration          int               `json:"max_duration"`
	BufferSeconds        int               `json:"buffer_seconds"`
	Snippets             []TranscriptSegment `json:"snippets"`
	VideoDurationSeconds int               `json:"video_duration_seconds"`
	ExcludeClips         []ExcludeClip     `json:"exclude_clips,omitempty"`
}

type Speaker struct {
	Name        string `json:"name"`
	Role        string `json:"role"`
	Position    string `json:"position"`
	Description string `json:"description"`
}

type AnalyzeResponse struct {
	Clips    []ClipRecommendation `json:"clips"`
	Speakers []Speaker            `json:"speakers"`
}

type ClipRecommendation struct {
	ClipID             int      `json:"clip_id"`
	Index              int      `json:"index"`
	StartSeconds       int      `json:"start_seconds"`
	EndSeconds         int      `json:"end_seconds"`
	DurationSeconds    int      `json:"duration_seconds"`
	Speaker            string   `json:"speaker"`
	SpeakersVisible    []string `json:"speakers_visible"`
	InteractionType    string   `json:"interaction_type"`
	Hook               string   `json:"hook"`
	Summary            string   `json:"summary"`
	Category           string   `json:"category"`
	EnergyLevel        string   `json:"energy_level"`
	ViralScore         float64  `json:"viral_score"`
	ContentScore       float64  `json:"content_score"`
	EngagementScore    float64  `json:"engagement_score"`
	ThumbnailText      string   `json:"thumbnail_text"`
	ThumbnailEmotion   string   `json:"thumbnail_emotion"`
	ThumbnailTimestamp int      `json:"thumbnail_timestamp"`
	SuggestedCaption   string   `json:"suggested_caption"`
	TranscriptExcerpt  string   `json:"transcript_excerpt"`
	EndCue             string   `json:"end_cue"`
}

type CutRequest struct {
	VideoPath string `json:"video_path"`
	ClipID    string `json:"clip_id"`
	Start     int    `json:"start"`
	End       int    `json:"end"`
	OutDir    string `json:"out_dir"`
}

type CutResponse struct {
	ClipPath string `json:"clip_path"`
}

type WhisperRequest struct {
	AudioPath string `json:"audio_path"`
	Language  string `json:"language"`
	ModelSize string `json:"model_size"` // tiny|base|small|medium; kosong = pakai env worker
}

type WhisperResponse struct {
	Words []WordTimestamp `json:"words"`
}

type WordTimestamp struct {
	Word  string  `json:"word"`
	Start float64 `json:"start"`
	End   float64 `json:"end"`
}

type DetectFacesRequest struct {
	ClipPath  string `json:"clip_path"`
	ModelPath string `json:"model_path"`
}

type DetectFacesResponse struct {
	FaceData interface{} `json:"face_data"`
	SourceW  int         `json:"source_w"`
	SourceH  int         `json:"source_h"`
	FPS      float64     `json:"fps"`
}

type ReframeRequest struct {
	ClipPath  string `json:"clip_path"`
	ModelPath string `json:"model_path"`
	SourceW   int    `json:"source_w"`
	SourceH   int    `json:"source_h"`
	Ratio     string `json:"ratio"`    // "9:16"|"1:1"|"4:5"
	Template  string `json:"template"` // single|dual|dual_side|static
}

type ReframeResponse struct {
	Centers      []float64 `json:"centers"`
	CentersLeft  []float64 `json:"centers_left,omitempty"`
	CentersRight []float64 `json:"centers_right,omitempty"`
	IsSplit      []bool    `json:"is_split,omitempty"`
	SourceW      int       `json:"source_w"`
	SourceH      int       `json:"source_h"`
	FPS          float64   `json:"fps"`
	Stats        map[string]interface{} `json:"stats"`
}

type SubtitleRequest struct {
	Words        []WordTimestamp `json:"words"`
	Style        string         `json:"style"`
	Position     string         `json:"position"`     // top|mid|bot
	Size         string         `json:"size"`         // S|M|L
	CaptionText  string         `json:"caption_text"` // manual override
	ClipDuration float64        `json:"clip_duration"`
	OutDir       string         `json:"out_dir"`
	ClipID       string         `json:"clip_id"`
	SplitMode    bool           `json:"split_mode"`
	ModelSize    string         `json:"model_size"`   // untuk whisper: tiny|base|small|medium
}

type SubtitleResponse struct {
	ASSPath    string `json:"ass_path"`
	ASSContent string `json:"ass_content"`
}

type CompositeRequest struct {
	ClipPath     string    `json:"clip_path"`
	ASSPath      string    `json:"ass_path"`
	Centers      []float64 `json:"centers"`
	CentersLeft  []float64 `json:"centers_left,omitempty"`
	CentersRight []float64 `json:"centers_right,omitempty"`
	IsSplit      []bool    `json:"is_split,omitempty"`
	SourceW      int       `json:"source_w"`
	SourceH      int       `json:"source_h"`
	ClipID       string    `json:"clip_id"`
	OutDir       string    `json:"out_dir"`
	Ratio        string    `json:"ratio"` // "9:16"|"1:1"|"4:5"
	ChannelName  string    `json:"channel_name"`
	SourceCredit string    `json:"source_credit"`
}

type CompositeResponse struct {
	OutputPath string `json:"output_path"`
}

// --- Worker methods ---

func (c *WorkerClient) Health(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/health", nil)
	if err != nil {
		return err
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	resp.Body.Close()
	return nil
}

func (c *WorkerClient) FetchMetadata(ctx context.Context, req MetadataRequest) (*MetadataResponse, error) {
	var result MetadataResponse
	return &result, c.post(ctx, "/metadata", req, &result)
}

// Download streams yt-dlp progress lines and calls onProgress(pct, msg) for each update.
// Returns the final video path when done.
func (c *WorkerClient) Download(ctx context.Context, req DownloadRequest, onProgress func(pct float64, msg string)) (*DownloadResponse, error) {
	payload, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost,
		c.baseURL+"/download", bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("worker request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		data, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("worker error %d: %s", resp.StatusCode, data)
	}

	scanner := bufio.NewScanner(resp.Body)
	var videoPath string
	for scanner.Scan() {
		line := scanner.Text()
		switch {
		case strings.HasPrefix(line, "PROGRESS:"):
			pctStr := strings.TrimPrefix(line, "PROGRESS:")
			var pct float64
			fmt.Sscanf(pctStr, "%f", &pct)
			if onProgress != nil {
				onProgress(pct, fmt.Sprintf("Mengunduh… %.0f%%", pct))
			}
		case strings.HasPrefix(line, "DONE:"):
			videoPath = strings.TrimPrefix(line, "DONE:")
		case strings.HasPrefix(line, "ERROR:"):
			return nil, fmt.Errorf("yt-dlp: %s", strings.TrimPrefix(line, "ERROR:"))
		case strings.HasPrefix(line, "LOG:"):
			// forwarded yt-dlp log lines — ignore at this level
		}
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}
	if videoPath == "" {
		return nil, fmt.Errorf("download completed but no video path returned")
	}
	return &DownloadResponse{VideoPath: videoPath}, nil
}

func (c *WorkerClient) FetchTranscript(ctx context.Context, req TranscriptRequest) (*TranscriptResponse, error) {
	var result TranscriptResponse
	return &result, c.post(ctx, "/transcript", req, &result)
}

func (c *WorkerClient) Analyze(ctx context.Context, req AnalyzeRequest) (*AnalyzeResponse, error) {
	var result AnalyzeResponse
	return &result, c.post(ctx, "/analyze", req, &result)
}

func (c *WorkerClient) Cut(ctx context.Context, req CutRequest) (*CutResponse, error) {
	var result CutResponse
	return &result, c.post(ctx, "/cut", req, &result)
}

func (c *WorkerClient) WhisperAlign(ctx context.Context, req WhisperRequest) (*WhisperResponse, error) {
	var result WhisperResponse
	return &result, c.post(ctx, "/whisper-align", req, &result)
}

func (c *WorkerClient) DetectFaces(ctx context.Context, req DetectFacesRequest) (*DetectFacesResponse, error) {
	var result DetectFacesResponse
	return &result, c.post(ctx, "/detect-faces", req, &result)
}

func (c *WorkerClient) Reframe(ctx context.Context, req ReframeRequest) (*ReframeResponse, error) {
	var result ReframeResponse
	return &result, c.post(ctx, "/reframe", req, &result)
}

func (c *WorkerClient) GenerateSubtitle(ctx context.Context, req SubtitleRequest) (*SubtitleResponse, error) {
	var result SubtitleResponse
	return &result, c.post(ctx, "/subtitle", req, &result)
}

func (c *WorkerClient) Composite(ctx context.Context, req CompositeRequest) (*CompositeResponse, error) {
	var result CompositeResponse
	return &result, c.post(ctx, "/composite", req, &result)
}

type WorkerTuningConfig struct {
	Encoder           string  `json:"encoder,omitempty"`
	Bitrate           string  `json:"bitrate,omitempty"`
	DeadzoneRatio     float64 `json:"deadzone_ratio,omitempty"`
	MaxSpeedPxPerSec  float64 `json:"max_speed_px_per_sec,omitempty"`
	SmoothingTauSec   float64 `json:"smoothing_tau_sec,omitempty"`
	SceneCutScore     float64 `json:"scene_cut_score,omitempty"`
	SceneCutHist      float64 `json:"scene_cut_hist,omitempty"`
	SceneCutPixel     float64 `json:"scene_cut_pixel,omitempty"`
	DataDir           string  `json:"data_dir,omitempty"`
}

type WorkerTuningResponse struct {
	Applied []string `json:"applied"`
}

// --- New request/response types ---

type WaveformRequest struct {
	AudioPath string `json:"audio_path"`
	Start     int    `json:"start"`
	End       int    `json:"end"`
	Samples   int    `json:"samples"`
}

type WaveformResponse struct {
	Peaks []float64 `json:"peaks"`
}

type ThumbnailsRequest struct {
	VideoPath string `json:"video_path"`
	Start     int    `json:"start"`
	End       int    `json:"end"`
	Count     int    `json:"count"`
	OutDir    string `json:"out_dir"`
}

type ThumbnailsResponse struct {
	Paths []string `json:"paths"`
}

type FacetrackRequest struct {
	VideoPath string `json:"video_path"`
	Start     int    `json:"start"`
	End       int    `json:"end"`
}

type FacetrackFrame struct {
	Frame int     `json:"frame"`
	Time  float64 `json:"time"`
	X     float64 `json:"x"`
	Y     float64 `json:"y"`
	W     float64 `json:"w"`
	H     float64 `json:"h"`
}

type FacetrackResponse struct {
	Frames []FacetrackFrame `json:"frames"`
}

type CaptionRequest struct {
	TranscriptExcerpt string `json:"transcript_excerpt"`
	Lang              string `json:"lang"`
	APIKey            string `json:"api_key"`
	Model             string `json:"model"`
	BaseURL           string `json:"base_url"`
}

type CaptionResponse struct {
	Caption string `json:"caption"`
}

func (c *WorkerClient) Configure(ctx context.Context, req WorkerTuningConfig) (*WorkerTuningResponse, error) {
	var result WorkerTuningResponse
	return &result, c.post(ctx, "/configure", req, &result)
}

// --- New worker methods ---

func (c *WorkerClient) Waveform(ctx context.Context, req WaveformRequest) (*WaveformResponse, error) {
	var result WaveformResponse
	return &result, c.post(ctx, "/waveform", req, &result)
}

func (c *WorkerClient) Thumbnails(ctx context.Context, req ThumbnailsRequest) (*ThumbnailsResponse, error) {
	var result ThumbnailsResponse
	return &result, c.post(ctx, "/thumbnails", req, &result)
}

func (c *WorkerClient) Facetrack(ctx context.Context, req FacetrackRequest) (*FacetrackResponse, error) {
	var result FacetrackResponse
	return &result, c.post(ctx, "/facetrack", req, &result)
}

func (c *WorkerClient) GenerateCaption(ctx context.Context, req CaptionRequest) (*CaptionResponse, error) {
	var result CaptionResponse
	return &result, c.post(ctx, "/caption", req, &result)
}

// --- Overlay editor (porting ContextClipper render.py) ---

type OverlayProbeRequest struct {
	VideoPath string `json:"video_path"`
}

type OverlayProbeResponse struct {
	Width    int     `json:"width"`
	Height   int     `json:"height"`
	FPS      float64 `json:"fps"`
	Duration float64 `json:"duration"`
}

func (c *WorkerClient) OverlayProbe(ctx context.Context, req OverlayProbeRequest) (*OverlayProbeResponse, error) {
	var result OverlayProbeResponse
	return &result, c.post(ctx, "/overlay/probe", req, &result)
}

type OverlaySpec struct {
	Kind       string  `json:"kind"`
	Path       string  `json:"path"`
	Fit        string  `json:"fit"`
	TrimOffset float64 `json:"trim_offset"`
}

type OverlayClickSpec struct {
	Enabled   bool    `json:"enabled"`
	Volume    float64 `json:"volume"`
	AssetPath string  `json:"asset_path"`
}

type OverlayRenderSegmentRequest struct {
	Kind            string           `json:"kind"` // copy|overlay|cover
	SourcePath      string           `json:"source_path"`
	OutPath         string           `json:"out_path"`
	SegStart        float64          `json:"seg_start"`
	SegEnd          float64          `json:"seg_end"`
	OutWidth        int              `json:"out_width"`
	OutHeight       int              `json:"out_height"`
	FPS             float64          `json:"fps"`
	CodecHint       string           `json:"codec_hint"`
	BackgroundColor string           `json:"background_color"`
	AreaRatio       float64          `json:"area_ratio"`
	ForceReencode   bool             `json:"force_reencode"`
	Overlays        []OverlaySpec    `json:"overlays"`
	Click           OverlayClickSpec `json:"click"`
	CoverImage      string           `json:"cover_image"`
	CoverDuration   float64          `json:"cover_duration"`
}

type OverlayRenderSegmentResponse struct {
	Code    int    `json:"code"`
	OutPath string `json:"out_path"`
}

func (c *WorkerClient) OverlayRenderSegment(ctx context.Context, req OverlayRenderSegmentRequest) (*OverlayRenderSegmentResponse, error) {
	var result OverlayRenderSegmentResponse
	return &result, c.post(ctx, "/overlay/render-segment", req, &result)
}

type OverlayConcatRequest struct {
	Inputs        []string `json:"inputs"`
	OutPath       string   `json:"out_path"`
	TmpDir        string   `json:"tmp_dir"`
	TryStreamCopy bool     `json:"try_stream_copy"`
}

type OverlayConcatResponse struct {
	Code      int    `json:"code"`
	OutPath   string `json:"out_path"`
	Reencoded bool   `json:"reencoded"`
}

func (c *WorkerClient) OverlayConcat(ctx context.Context, req OverlayConcatRequest) (*OverlayConcatResponse, error) {
	var result OverlayConcatResponse
	return &result, c.post(ctx, "/overlay/concat", req, &result)
}

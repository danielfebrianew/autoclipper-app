package config

import (
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"
)

type Config struct {
	License    LicenseConfig    `yaml:"license"`
	Encryption EncryptionConfig `yaml:"encryption"`
	Gemini     GeminiConfig     `yaml:"gemini"`
	Paths      PathsConfig      `yaml:"paths"`
	Worker     WorkerConfig     `yaml:"worker"`
	Processing ProcessingConfig `yaml:"processing"`
	Heatmap    HeatmapConfig    `yaml:"heatmap"`
	Models     ModelsConfig     `yaml:"models"`
	Downloads  DownloadsConfig  `yaml:"downloads"`
	Video      VideoConfig      `yaml:"video"`
	Preview    PreviewConfig    `yaml:"preview"`
}

type LicenseConfig struct {
	Salt string `yaml:"salt"`
}

type EncryptionConfig struct {
	Key string `yaml:"key"`
}

type GeminiConfig struct {
	APIKey  string `yaml:"api_key"`
	BaseURL string `yaml:"base_url"`
	Model   string `yaml:"model"`
}

type PathsConfig struct {
	DataDir   string `yaml:"data_dir"`
	OutputDir string `yaml:"output_dir"`
	LogFile   string `yaml:"log_file"`
}

type WorkerConfig struct {
	Host string `yaml:"host"`
	Port int    `yaml:"port"`
}

type ProcessingConfig struct {
	MaxClips           int    `yaml:"max_clips"`
	MinDuration        int    `yaml:"min_duration"`
	MaxDuration        int    `yaml:"max_duration"`
	BufferSeconds      int    `yaml:"buffer_seconds"`
	TranscriptLanguage string `yaml:"transcript_language"`
	SubtitleStyle      string `yaml:"subtitle_style"`
}

type HeatmapConfig struct {
	PeakThreshold    float64 `yaml:"peak_threshold"`
	HighThreshold    float64 `yaml:"high_threshold"`
	EngagementWeight float64 `yaml:"engagement_weight"`
	ContentWeight    float64 `yaml:"content_weight"`
}

type ModelsConfig struct {
	YOLOFace string `yaml:"yolo_face"`
	Whisper  string `yaml:"whisper"`
}

type VideoConfig struct {
	Encoder string `yaml:"encoder"` // auto|h264_videotoolbox|libx264
	Bitrate string `yaml:"bitrate"` // e.g. "5000k"

	// Crop tuning — maps to AUTOCLIPPER_CROP_* env vars
	DeadzoneRatio    float64 `yaml:"deadzone_ratio"`
	MaxSpeedPxPerSec float64 `yaml:"max_speed_px_per_sec"`
	SmoothingTauSec  float64 `yaml:"smoothing_tau_sec"`

	// Scene cut thresholds
	SceneCutScore float64 `yaml:"scene_cut_score"`
	SceneCutHist  float64 `yaml:"scene_cut_hist"`
	SceneCutPixel float64 `yaml:"scene_cut_pixel"`
}

type PreviewConfig struct {
	Enabled       bool   `yaml:"enabled"`        // aktifkan preview mode saat generate
	WhisperModel  string `yaml:"whisper_model"`  // default "tiny"
	TrackTemplate string `yaml:"track_template"` // default "static"
}

type DownloadsConfig struct {
	FFmpeg   FFmpegDownloads `yaml:"ffmpeg"`
	YOLOFace string          `yaml:"yolo_face"`
}

type FFmpegDownloads struct {
	Mac     string `yaml:"mac"`
	Windows string `yaml:"windows"`
}

var cfg *Config

func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	cfg = &Config{}
	if err := yaml.Unmarshal(data, cfg); err != nil {
		return nil, err
	}
	expandPaths(cfg)
	return cfg, nil
}

func Get() *Config {
	return cfg
}

func expandPaths(c *Config) {
	home, _ := os.UserHomeDir()
	expand := func(p string) string {
		if strings.HasPrefix(p, "~/") {
			return filepath.Join(home, p[2:])
		}
		return p
	}
	c.Paths.DataDir = expand(c.Paths.DataDir)
	c.Paths.OutputDir = expand(c.Paths.OutputDir)
	c.Paths.LogFile = expand(c.Paths.LogFile)
}

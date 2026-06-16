package setup

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"

	"auto-clipper/internal/config"

	"github.com/rs/zerolog/log"
)

type DependencyStatus string

const (
	StatusOK       DependencyStatus = "ok"
	StatusMissing  DependencyStatus = "missing"
	StatusInstalling DependencyStatus = "installing"
	StatusError    DependencyStatus = "error"
)

type Dependency struct {
	Name    string           `json:"name"`
	Status  DependencyStatus `json:"status"`
	Message string           `json:"message"`
}

type ProgressEvent struct {
	Name     string           `json:"name"`
	Status   DependencyStatus `json:"status"`
	Progress float64          `json:"progress"`
	Message  string           `json:"message"`
}

type ProgressCallback func(ProgressEvent)

func CheckDependencies(cfg *config.Config) []Dependency {
	deps := []Dependency{}

	// Python
	if _, err := exec.LookPath("python3"); err != nil {
		deps = append(deps, Dependency{Name: "Python 3.11+", Status: StatusMissing, Message: "python3 not found in PATH"})
	} else {
		out, _ := exec.Command("python3", "--version").Output()
		deps = append(deps, Dependency{Name: "Python 3.11+", Status: StatusOK, Message: string(out)})
	}

	// FFmpeg
	ffmpegPath := localFFmpegPath(cfg)
	if _, err := os.Stat(ffmpegPath); err == nil {
		deps = append(deps, Dependency{Name: "FFmpeg", Status: StatusOK, Message: ffmpegPath})
	} else if _, err := exec.LookPath("ffmpeg"); err == nil {
		deps = append(deps, Dependency{Name: "FFmpeg", Status: StatusOK, Message: "system ffmpeg"})
	} else {
		deps = append(deps, Dependency{Name: "FFmpeg", Status: StatusMissing, Message: "not found"})
	}

	// Python venv
	venvPath := filepath.Join(cfg.Paths.DataDir, "venv")
	if _, err := os.Stat(venvPath); err == nil {
		deps = append(deps, Dependency{Name: "Python venv", Status: StatusOK, Message: venvPath})
	} else {
		deps = append(deps, Dependency{Name: "Python venv", Status: StatusMissing, Message: "venv not created"})
	}

	// YOLO model
	yoloPath := filepath.Join(cfg.Paths.DataDir, "models", cfg.Models.YOLOFace)
	if _, err := os.Stat(yoloPath); err == nil {
		deps = append(deps, Dependency{Name: "YOLOv8 face model", Status: StatusOK, Message: yoloPath})
	} else {
		deps = append(deps, Dependency{Name: "YOLOv8 face model", Status: StatusMissing, Message: "not downloaded"})
	}

	return deps
}

func RunSetup(cfg *config.Config, onProgress ProgressCallback) error {
	if err := os.MkdirAll(cfg.Paths.DataDir, 0755); err != nil {
		return err
	}
	if err := os.MkdirAll(cfg.Paths.OutputDir, 0755); err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Join(cfg.Paths.DataDir, "models"), 0755); err != nil {
		return err
	}

	// FFmpeg
	if err := ensureFFmpeg(cfg, onProgress); err != nil {
		return fmt.Errorf("ffmpeg setup failed: %w", err)
	}

	// Python venv
	if err := ensureVenv(cfg, onProgress); err != nil {
		return fmt.Errorf("venv setup failed: %w", err)
	}

	// pip packages
	if err := installPipPackages(cfg, onProgress); err != nil {
		return fmt.Errorf("pip install failed: %w", err)
	}

	// YOLO model
	if err := ensureYOLOModel(cfg, onProgress); err != nil {
		return fmt.Errorf("yolo model download failed: %w", err)
	}

	log.Info().Msg("Setup complete")
	return nil
}

func ensureFFmpeg(cfg *config.Config, cb ProgressCallback) error {
	if _, err := exec.LookPath("ffmpeg"); err == nil {
		return nil
	}

	ffmpegPath := localFFmpegPath(cfg)
	if _, err := os.Stat(ffmpegPath); err == nil {
		return nil
	}

	cb(ProgressEvent{Name: "FFmpeg", Status: StatusInstalling, Progress: 0, Message: "Downloading FFmpeg..."})

	var url string
	if runtime.GOOS == "darwin" {
		url = cfg.Downloads.FFmpeg.Mac
	} else {
		url = cfg.Downloads.FFmpeg.Windows
	}

	zipPath := filepath.Join(cfg.Paths.DataDir, "ffmpeg.zip")
	if err := DownloadFile(url, zipPath, func(d, t int64) {
		if t > 0 {
			cb(ProgressEvent{Name: "FFmpeg", Status: StatusInstalling, Progress: float64(d) / float64(t) * 100})
		}
	}); err != nil {
		return err
	}

	cb(ProgressEvent{Name: "FFmpeg", Status: StatusOK, Progress: 100, Message: "FFmpeg ready"})
	return nil
}

func ensureVenv(cfg *config.Config, cb ProgressCallback) error {
	venvPath := filepath.Join(cfg.Paths.DataDir, "venv")
	if _, err := os.Stat(venvPath); err == nil {
		return nil
	}

	cb(ProgressEvent{Name: "Python venv", Status: StatusInstalling, Progress: 0, Message: "Creating virtual environment..."})
	cmd := exec.Command("python3", "-m", "venv", venvPath)
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("%w: %s", err, out)
	}

	cb(ProgressEvent{Name: "Python venv", Status: StatusOK, Progress: 100, Message: "venv ready"})
	return nil
}

func installPipPackages(cfg *config.Config, cb ProgressCallback) error {
	cb(ProgressEvent{Name: "pip packages", Status: StatusInstalling, Progress: 0, Message: "Installing Python packages..."})

	venvPip := filepath.Join(cfg.Paths.DataDir, "venv", "bin", "pip")
	if runtime.GOOS == "windows" {
		venvPip = filepath.Join(cfg.Paths.DataDir, "venv", "Scripts", "pip.exe")
	}

	// requirements.txt path relative to binary — assume worker/ sibling
	reqPath := "worker/requirements.txt"
	cmd := exec.Command(venvPip, "install", "-r", reqPath)
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("%w: %s", err, out)
	}

	cb(ProgressEvent{Name: "pip packages", Status: StatusOK, Progress: 100, Message: "packages installed"})
	return nil
}

func ensureYOLOModel(cfg *config.Config, cb ProgressCallback) error {
	yoloPath := filepath.Join(cfg.Paths.DataDir, "models", cfg.Models.YOLOFace)
	if _, err := os.Stat(yoloPath); err == nil {
		return nil
	}

	cb(ProgressEvent{Name: "YOLOv8 face model", Status: StatusInstalling, Progress: 0, Message: "Downloading YOLOv8 face model..."})
	if err := DownloadFile(cfg.Downloads.YOLOFace, yoloPath, func(d, t int64) {
		if t > 0 {
			cb(ProgressEvent{Name: "YOLOv8 face model", Status: StatusInstalling, Progress: float64(d) / float64(t) * 100})
		}
	}); err != nil {
		return err
	}

	cb(ProgressEvent{Name: "YOLOv8 face model", Status: StatusOK, Progress: 100, Message: "model ready"})
	return nil
}

func localFFmpegPath(cfg *config.Config) string {
	name := "ffmpeg"
	if runtime.GOOS == "windows" {
		name = "ffmpeg.exe"
	}
	return filepath.Join(cfg.Paths.DataDir, "bin", name)
}

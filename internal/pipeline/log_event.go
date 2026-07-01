package pipeline

import "strings"

// LogEvent is the payload for the "worker:log" Wails event.
// JSON tags MUST match the frontend LogLine: t, tool, level, m.
type LogEvent struct {
	T         string `json:"t"`     // RFC3339 timestamp
	Tool      string `json:"tool"`  // youtube|ffmpeg|whisper|gemini|yolov8|worker
	Level     string `json:"level"` // info|ok|warn|err
	M         string `json:"m"`     // message
	ProjectID string `json:"project_id,omitempty"`
	ClipID    string `json:"clip_id,omitempty"`
}

// InferLevel applies simple heuristics to a raw tool line to pick a severity.
func InferLevel(line string) string {
	l := strings.ToLower(line)
	switch {
	case strings.Contains(l, "error") || strings.Contains(l, "failed") || strings.Contains(l, "traceback"):
		return "err"
	case strings.Contains(l, "warning") || strings.Contains(l, "warn"):
		return "warn"
	default:
		return "info"
	}
}

// toolForStep maps a download/analyze pipeline step to its tool tag.
func toolForStep(step string) string {
	switch step {
	case "metadata", "download", "transcript":
		return "youtube"
	case "heatmap", "analyze":
		return "gemini"
	default:
		return "worker"
	}
}

// toolForClipStep maps a clip-generation step to its tool tag.
func toolForClipStep(step string) string {
	switch step {
	case "whisper":
		return "whisper"
	case "reframe":
		return "yolov8"
	default: // cut, subtitle, composite, done
		return "ffmpeg"
	}
}

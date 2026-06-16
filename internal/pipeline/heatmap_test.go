package pipeline

import "testing"

func TestFindPeaks(t *testing.T) {
	heatmap := []HeatmapEntry{
		{StartTime: 0, EndTime: 20, Value: 0.3},
		{StartTime: 20, EndTime: 40, Value: 0.8},  // peak
		{StartTime: 40, EndTime: 60, Value: 0.2},
		{StartTime: 60, EndTime: 80, Value: 0.92}, // highest peak
		{StartTime: 80, EndTime: 100, Value: 0.1},
	}

	peaks := FindPeaks(heatmap, 0.5)

	if len(peaks) != 2 {
		t.Fatalf("expected 2 peaks, got %d", len(peaks))
	}
	if peaks[0].Value != 0.92 {
		t.Errorf("expected highest peak first, got %f", peaks[0].Value)
	}
	if peaks[1].Value != 0.8 {
		t.Errorf("expected second peak 0.8, got %f", peaks[1].Value)
	}
}

func TestFindPeaksNone(t *testing.T) {
	heatmap := []HeatmapEntry{
		{StartTime: 0, EndTime: 20, Value: 0.1},
		{StartTime: 20, EndTime: 40, Value: 0.3},
	}
	peaks := FindPeaks(heatmap, 0.5)
	if len(peaks) != 0 {
		t.Errorf("expected 0 peaks, got %d", len(peaks))
	}
}

func TestParseHeatmap(t *testing.T) {
	raw := `[{"start_time":0,"end_time":20,"value":0.5},{"start_time":20,"end_time":40,"value":0.8}]`
	entries, err := ParseHeatmap(raw)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(entries) != 2 {
		t.Errorf("expected 2 entries, got %d", len(entries))
	}
	if entries[1].Value != 0.8 {
		t.Errorf("expected 0.8, got %f", entries[1].Value)
	}
}

func TestFormatHeatmapForLLM(t *testing.T) {
	entries := []HeatmapEntry{
		{StartTime: 0, EndTime: 20, Value: 0.3},
		{StartTime: 20, EndTime: 40, Value: 0.8},
	}
	out := FormatHeatmapForLLM(entries, 0.5, 0.7)
	if out == "" {
		t.Error("expected non-empty output")
	}
	if out[:5] != "Video" {
		t.Errorf("expected output to start with 'Video', got %q", out[:5])
	}
}

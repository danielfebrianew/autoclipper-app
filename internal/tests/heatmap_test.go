// Package tests holds cross-package unit tests that exercise the exported API of
// the internal/* packages. Each function uses table-driven cases.
package tests

import (
	"strings"
	"testing"

	"auto-clipper/internal/pipeline"
)

func TestParseHeatmap(t *testing.T) {
	cases := []struct {
		name      string
		raw       string
		wantLen   int
		wantErr   bool
		lastValue float64
	}{
		{
			name:      "two valid entries",
			raw:       `[{"start_time":0,"end_time":20,"value":0.5},{"start_time":20,"end_time":40,"value":0.8}]`,
			wantLen:   2,
			lastValue: 0.8,
		},
		{
			name:    "empty array",
			raw:     `[]`,
			wantLen: 0,
		},
		{
			name:    "malformed json returns error",
			raw:     `not json`,
			wantErr: true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			entries, err := pipeline.ParseHeatmap(tc.raw)
			if tc.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if len(entries) != tc.wantLen {
				t.Fatalf("len = %d, want %d", len(entries), tc.wantLen)
			}
			if tc.wantLen > 0 && entries[len(entries)-1].Value != tc.lastValue {
				t.Errorf("last value = %f, want %f", entries[len(entries)-1].Value, tc.lastValue)
			}
		})
	}
}

func TestFindPeaks(t *testing.T) {
	entries := []pipeline.HeatmapEntry{
		{StartTime: 0, EndTime: 20, Value: 0.3},
		{StartTime: 20, EndTime: 40, Value: 0.8},  // peak
		{StartTime: 40, EndTime: 60, Value: 0.2},
		{StartTime: 60, EndTime: 80, Value: 0.92}, // highest
		{StartTime: 80, EndTime: 100, Value: 0.1},
	}

	cases := []struct {
		name      string
		threshold float64
		wantLen   int
		wantFirst float64 // highest, peaks must be sorted desc
	}{
		{name: "threshold 0.5 keeps two", threshold: 0.5, wantLen: 2, wantFirst: 0.92},
		{name: "threshold 0.95 keeps none", threshold: 0.95, wantLen: 0},
		{name: "threshold 0.0 keeps all", threshold: 0.0, wantLen: 5, wantFirst: 0.92},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			peaks := pipeline.FindPeaks(entries, tc.threshold)
			if len(peaks) != tc.wantLen {
				t.Fatalf("len = %d, want %d", len(peaks), tc.wantLen)
			}
			if tc.wantLen > 0 && peaks[0].Value != tc.wantFirst {
				t.Errorf("first peak = %f, want %f (must be sorted desc)", peaks[0].Value, tc.wantFirst)
			}
			// Verify the whole slice is sorted descending.
			for i := 1; i < len(peaks); i++ {
				if peaks[i-1].Value < peaks[i].Value {
					t.Errorf("peaks not sorted desc at %d: %f < %f", i, peaks[i-1].Value, peaks[i].Value)
				}
			}
		})
	}
}

func TestFormatHeatmapForLLM(t *testing.T) {
	entries := []pipeline.HeatmapEntry{
		{StartTime: 0, EndTime: 20, Value: 0.30},  // no marker
		{StartTime: 20, EndTime: 40, Value: 0.65}, // HIGH
		{StartTime: 40, EndTime: 60, Value: 0.90}, // PEAK
	}
	out := pipeline.FormatHeatmapForLLM(entries, 0.5, 0.8)

	if !strings.HasPrefix(out, "Video engagement heatmap") {
		t.Errorf("missing header, got prefix %q", out[:min(30, len(out))])
	}
	if !strings.Contains(out, "[HIGH]") {
		t.Error("expected a [HIGH] marker for value 0.65 (>= 0.5, < 0.8)")
	}
	if !strings.Contains(out, "[PEAK]") {
		t.Error("expected a [PEAK] marker for value 0.90 (>= 0.8)")
	}
	if strings.Contains(strings.SplitN(out, "\n", 2)[0], "[") {
		t.Error("header line should not carry a marker")
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

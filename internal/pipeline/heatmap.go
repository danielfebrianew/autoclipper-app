package pipeline

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
)

type HeatmapEntry struct {
	StartTime float64 `json:"start_time"`
	EndTime   float64 `json:"end_time"`
	Value     float64 `json:"value"`
}

type HeatmapPeak struct {
	StartTime float64 `json:"start_time"`
	EndTime   float64 `json:"end_time"`
	Value     float64 `json:"value"`
}

func ParseHeatmap(rawJSON string) ([]HeatmapEntry, error) {
	var entries []HeatmapEntry
	if err := json.Unmarshal([]byte(rawJSON), &entries); err != nil {
		return nil, fmt.Errorf("failed to parse heatmap JSON: %w", err)
	}
	return entries, nil
}

func FindPeaks(entries []HeatmapEntry, threshold float64) []HeatmapPeak {
	var peaks []HeatmapPeak
	for _, e := range entries {
		if e.Value >= threshold {
			peaks = append(peaks, HeatmapPeak{
				StartTime: e.StartTime,
				EndTime:   e.EndTime,
				Value:     e.Value,
			})
		}
	}
	// Sort descending by value
	sort.Slice(peaks, func(i, j int) bool {
		return peaks[i].Value > peaks[j].Value
	})
	return peaks
}

func FormatHeatmapForLLM(entries []HeatmapEntry, threshold, highThreshold float64) string {
	var sb strings.Builder
	sb.WriteString("Video engagement heatmap (normalized 0-1):\n")

	for _, e := range entries {
		marker := ""
		if e.Value >= highThreshold {
			marker = " [PEAK]"
		} else if e.Value >= threshold {
			marker = " [HIGH]"
		}
		sb.WriteString(fmt.Sprintf("  %ds-%ds: %.2f%s\n",
			int(e.StartTime), int(e.EndTime), e.Value, marker))
	}
	return sb.String()
}

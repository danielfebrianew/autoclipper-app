package pipeline

import (
	"strings"
	"testing"
)

func TestParseDownloadStream(t *testing.T) {
	input := strings.Join([]string{
		"LOG:[youtube] extracting video info",
		"PROGRESS:50.0",
		"LOG:[download]  50% of 400MiB",
		"PROGRESS:100.0",
		"DONE:/data/videos/abc.mp4",
	}, "\n")

	var logs []string
	var lastPct float64
	path, err := parseDownloadStream(strings.NewReader(input),
		func(pct float64, _ string) { lastPct = pct },
		func(line string) { logs = append(logs, line) },
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if path != "/data/videos/abc.mp4" {
		t.Errorf("videoPath = %q, want /data/videos/abc.mp4", path)
	}
	if lastPct != 100.0 {
		t.Errorf("lastPct = %v, want 100", lastPct)
	}
	// Both LOG: lines must be forwarded (no longer discarded).
	if len(logs) != 2 {
		t.Fatalf("onLog called %d times, want 2: %v", len(logs), logs)
	}
	if logs[0] != "[youtube] extracting video info" {
		t.Errorf("logs[0] = %q", logs[0])
	}
}

func TestParseDownloadStream_Error(t *testing.T) {
	input := "LOG:starting\nERROR:HTTP 403 forbidden\n"
	var logs []string
	_, err := parseDownloadStream(strings.NewReader(input), nil,
		func(line string) { logs = append(logs, line) },
	)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	// The ERROR line should also surface in the log stream.
	found := false
	for _, l := range logs {
		if strings.Contains(l, "403 forbidden") {
			found = true
		}
	}
	if !found {
		t.Errorf("ERROR line not forwarded to onLog: %v", logs)
	}
}

func TestInferLevel(t *testing.T) {
	cases := map[string]string{
		"Download failed: HTTP 403":     "err",
		"traceback (most recent call)":  "err",
		"WARNING: rate limited":         "warn",
		"[download] 50% of 400MiB":      "info",
	}
	for line, want := range cases {
		if got := InferLevel(line); got != want {
			t.Errorf("InferLevel(%q) = %q, want %q", line, got, want)
		}
	}
}

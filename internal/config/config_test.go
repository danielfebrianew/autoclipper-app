package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestExpandPaths(t *testing.T) {
	home, err := os.UserHomeDir()
	if err != nil {
		t.Skip("no home dir available")
	}

	c := &Config{}
	c.Paths.DataDir = "~/data"
	c.Paths.OutputDir = "/absolute/output" // no ~ -> unchanged
	c.Paths.LogFile = "~/logs/app.log"

	expandPaths(c)

	if want := filepath.Join(home, "data"); c.Paths.DataDir != want {
		t.Errorf("DataDir = %q, want %q", c.Paths.DataDir, want)
	}
	if c.Paths.OutputDir != "/absolute/output" {
		t.Errorf("OutputDir should be unchanged, got %q", c.Paths.OutputDir)
	}
	if want := filepath.Join(home, "logs/app.log"); c.Paths.LogFile != want {
		t.Errorf("LogFile = %q, want %q", c.Paths.LogFile, want)
	}
}

func TestExpandPathsLeavesPlainPaths(t *testing.T) {
	// A bare "~" (without the "/" separator) is intentionally not expanded.
	c := &Config{}
	c.Paths.DataDir = "~tilde-no-slash"
	c.Paths.OutputDir = "relative/path"
	expandPaths(c)

	if c.Paths.DataDir != "~tilde-no-slash" {
		t.Errorf("DataDir mutated: %q", c.Paths.DataDir)
	}
	if c.Paths.OutputDir != "relative/path" {
		t.Errorf("OutputDir mutated: %q", c.Paths.OutputDir)
	}
}

func TestLoad(t *testing.T) {
	dir := t.TempDir()
	cfgPath := filepath.Join(dir, "config.yaml")
	yaml := `
gemini:
  api_key: secret
  base_url: https://api.kie.ai
  model: gemini-3-flash
worker:
  host: 127.0.0.1
  port: 8123
processing:
  max_clips: 5
  min_duration: 20
  max_duration: 90
heatmap:
  peak_threshold: 0.7
  high_threshold: 0.85
paths:
  data_dir: /tmp/ac-data
`
	if err := os.WriteFile(cfgPath, []byte(yaml), 0644); err != nil {
		t.Fatalf("write config: %v", err)
	}

	c, err := Load(cfgPath)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if c.Gemini.APIKey != "secret" {
		t.Errorf("APIKey = %q", c.Gemini.APIKey)
	}
	if c.Worker.Port != 8123 {
		t.Errorf("Port = %d, want 8123", c.Worker.Port)
	}
	if c.Processing.MaxClips != 5 {
		t.Errorf("MaxClips = %d, want 5", c.Processing.MaxClips)
	}
	if c.Heatmap.PeakThreshold != 0.7 {
		t.Errorf("PeakThreshold = %v, want 0.7", c.Heatmap.PeakThreshold)
	}
	// Get() should return the most recently loaded config.
	if Get() != c {
		t.Error("Get() did not return the loaded config")
	}
}

func TestLoadErrors(t *testing.T) {
	t.Run("missing file", func(t *testing.T) {
		if _, err := Load(filepath.Join(t.TempDir(), "nope.yaml")); err == nil {
			t.Error("expected error for missing file")
		}
	})
	t.Run("invalid yaml", func(t *testing.T) {
		p := filepath.Join(t.TempDir(), "bad.yaml")
		os.WriteFile(p, []byte("worker:\n  port: : :\n"), 0644)
		if _, err := Load(p); err == nil {
			t.Error("expected error for invalid yaml")
		}
	})
}

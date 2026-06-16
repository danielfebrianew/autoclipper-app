package settings

import (
	"fmt"

	"github.com/jmoiron/sqlx"
)

type Settings struct {
	GeminiAPIKey       string `json:"gemini_api_key"`
	KIEAPIKey          string `json:"kie_api_key"`
	OpenAIAPIKey       string `json:"openai_api_key"`
	GeminiModel        string `json:"gemini_model"`
	TranscriptLanguage string `json:"transcript_language"`
	TranscriptEngine   string `json:"transcript_engine"`
	SubtitleStyle      string `json:"subtitle_style"`
	MaxClips           int    `json:"max_clips"`
	MinDuration        int    `json:"min_duration"`
	MaxDuration        int    `json:"max_duration"`
	OutputDir          string `json:"output_dir"`
	LicenseSerial      string `json:"license_serial"`
	DefaultRatio       string `json:"default_ratio"`
	DefaultClipDuration int   `json:"default_clip_duration"`
	AutoReframe        bool   `json:"auto_reframe"`
	DeleteSourceAfter  bool   `json:"delete_source_after"`
	OpenOnStartup      bool   `json:"open_on_startup"`
	UILanguage         string `json:"ui_language"`
	StorageLimitGB     float64 `json:"storage_limit_gb"`
}

type Service struct {
	db         *sqlx.DB
	encryptKey string
}

func NewService(db *sqlx.DB, encryptKey string) *Service {
	return &Service{db: db, encryptKey: encryptKey}
}

func (s *Service) Get() (*Settings, error) {
	rows, err := s.db.Query("SELECT key, value FROM settings")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	m := map[string]string{}
	for rows.Next() {
		var k, v string
		if err := rows.Scan(&k, &v); err != nil {
			return nil, err
		}
		m[k] = v
	}

	settings := &Settings{
		GeminiAPIKey:        s.maybeDecrypt(m["gemini_api_key"]),
		KIEAPIKey:           s.maybeDecrypt(m["kie_api_key"]),
		OpenAIAPIKey:        s.maybeDecrypt(m["openai_api_key"]),
		GeminiModel:         orDefault(m["gemini_model"], "gemini-1.5-flash"),
		TranscriptLanguage:  orDefault(m["transcript_language"], "id"),
		TranscriptEngine:    orDefault(m["transcript_engine"], "youtube"),
		SubtitleStyle:       orDefault(m["subtitle_style"], "tiktok"),
		MaxClips:            intOrDefault(m["max_clips"], 10),
		MinDuration:         intOrDefault(m["min_duration"], 20),
		MaxDuration:         intOrDefault(m["max_duration"], 90),
		OutputDir:           m["output_dir"],
		LicenseSerial:       m["license_serial"],
		DefaultRatio:        orDefault(m["default_ratio"], "9:16"),
		DefaultClipDuration: intOrDefault(m["default_clip_duration"], 60),
		AutoReframe:         boolOrDefault(m["auto_reframe"], true),
		DeleteSourceAfter:   boolOrDefault(m["delete_source_after"], false),
		OpenOnStartup:       boolOrDefault(m["open_on_startup"], true),
		UILanguage:          orDefault(m["ui_language"], "id"),
		StorageLimitGB:      floatOrDefault(m["storage_limit_gb"], 50),
	}
	return settings, nil
}

func (s *Service) Save(settings *Settings) error {
	encGemini, err := encryptIfNonEmpty(s.encryptKey, settings.GeminiAPIKey)
	if err != nil {
		return err
	}
	encKIE, err := encryptIfNonEmpty(s.encryptKey, settings.KIEAPIKey)
	if err != nil {
		return err
	}
	encOpenAI, err := encryptIfNonEmpty(s.encryptKey, settings.OpenAIAPIKey)
	if err != nil {
		return err
	}

	pairs := map[string]string{
		"gemini_api_key":        encGemini,
		"kie_api_key":           encKIE,
		"openai_api_key":        encOpenAI,
		"gemini_model":          settings.GeminiModel,
		"transcript_language":   settings.TranscriptLanguage,
		"transcript_engine":     settings.TranscriptEngine,
		"subtitle_style":        settings.SubtitleStyle,
		"max_clips":             itoa(settings.MaxClips),
		"min_duration":          itoa(settings.MinDuration),
		"max_duration":          itoa(settings.MaxDuration),
		"output_dir":            settings.OutputDir,
		"license_serial":        settings.LicenseSerial,
		"default_ratio":         settings.DefaultRatio,
		"default_clip_duration": itoa(settings.DefaultClipDuration),
		"auto_reframe":          btoa(settings.AutoReframe),
		"delete_source_after":   btoa(settings.DeleteSourceAfter),
		"open_on_startup":       btoa(settings.OpenOnStartup),
		"ui_language":           settings.UILanguage,
		"storage_limit_gb":      ftoa(settings.StorageLimitGB),
	}

	for k, v := range pairs {
		_, err := s.db.Exec(
			`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
			k, v,
		)
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) SetKey(key, value string) error {
	_, err := s.db.Exec(
		`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
		key, value,
	)
	return err
}

func (s *Service) GetKey(key string) (string, error) {
	var value string
	err := s.db.Get(&value, "SELECT value FROM settings WHERE key = ?", key)
	return value, err
}

func (s *Service) maybeDecrypt(v string) string {
	if v == "" {
		return ""
	}
	plain, err := decrypt(s.encryptKey, v)
	if err != nil {
		return ""
	}
	return plain
}

func encryptIfNonEmpty(key, value string) (string, error) {
	if value == "" {
		return "", nil
	}
	return encrypt(key, value)
}

func orDefault(v, def string) string {
	if v == "" {
		return def
	}
	return v
}

func intOrDefault(v string, def int) int {
	if v == "" {
		return def
	}
	var n int
	fmt.Sscanf(v, "%d", &n)
	return n
}

func boolOrDefault(v string, def bool) bool {
	if v == "" {
		return def
	}
	return v == "1" || v == "true"
}

func floatOrDefault(v string, def float64) float64 {
	if v == "" {
		return def
	}
	var f float64
	fmt.Sscanf(v, "%f", &f)
	return f
}

func itoa(n int) string {
	return fmt.Sprintf("%d", n)
}

func btoa(b bool) string {
	if b {
		return "1"
	}
	return "0"
}

func ftoa(f float64) string {
	return fmt.Sprintf("%g", f)
}

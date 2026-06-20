package clip

import (
	"time"

	"github.com/jmoiron/sqlx"
)

type Clip struct {
	ID                 string    `db:"id"                   json:"id"`
	ProjectID          string    `db:"project_id"           json:"project_id"`
	ClipIndex          int       `db:"clip_index"           json:"clip_index"`
	StartSeconds       int       `db:"start_seconds"        json:"start_seconds"`
	EndSeconds         int       `db:"end_seconds"          json:"end_seconds"`
	DurationSeconds    int       `db:"duration_seconds"     json:"duration_seconds"`
	Speaker            string    `db:"speaker"              json:"speaker"`
	Hook               string    `db:"hook"                 json:"hook"`
	Summary            string    `db:"summary"              json:"summary"`
	Category           string    `db:"category"             json:"category"`
	EnergyLevel        string    `db:"energy_level"         json:"energy_level"`
	ViralScore         float64   `db:"viral_score"          json:"viral_score"`
	ContentScore       float64   `db:"content_score"        json:"content_score"`
	EngagementScore    float64   `db:"engagement_score"     json:"engagement_score"`
	ThumbnailText      string    `db:"thumbnail_text"       json:"thumbnail_text"`
	ThumbnailEmotion   string    `db:"thumbnail_emotion"    json:"thumbnail_emotion"`
	ThumbnailTimestamp int       `db:"thumbnail_timestamp"  json:"thumbnail_timestamp"`
	SuggestedCaption   string    `db:"suggested_caption"    json:"suggested_caption"`
	TranscriptExcerpt  string    `db:"transcript_excerpt"   json:"transcript_excerpt"`
	Enabled            bool      `db:"enabled"              json:"enabled"`
	Status             string    `db:"status"               json:"status"`
	RawClipPath        string    `db:"raw_clip_path"        json:"raw_clip_path"`
	FaceDataJSON       string    `db:"face_data_json"       json:"face_data_json"`
	SubtitlePath       string    `db:"subtitle_path"        json:"subtitle_path"`
	FinalClipPath      string    `db:"final_clip_path"      json:"final_clip_path"`
	// Editor fields (migration 005)
	AspectRatio       string `db:"aspect_ratio"       json:"aspect_ratio"`
	CaptionStyle      string `db:"caption_style"      json:"caption_style"`
	CaptionPosition   string `db:"caption_position"   json:"caption_position"`
	CaptionSize       string `db:"caption_size"       json:"caption_size"`
	CaptionText       string `db:"caption_text"       json:"caption_text"`
	TrackTemplate     string `db:"track_template"     json:"track_template"`
	TrackSmooth       bool   `db:"track_smooth"       json:"track_smooth"`
	TrackLockMain     bool   `db:"track_lock_main"    json:"track_lock_main"`
	TrackSensitivity  int    `db:"track_sensitivity"  json:"track_sensitivity"`
	WaveformPath      string `db:"waveform_path"      json:"waveform_path"`
	Favorite          bool   `db:"favorite"           json:"favorite"`
	CreatedAt         time.Time `db:"created_at"      json:"created_at"`
	UpdatedAt         time.Time `db:"updated_at"      json:"updated_at"`
}

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) CreateBatch(clips []Clip) error {
	query := `INSERT INTO clips
		(id, project_id, clip_index, start_seconds, end_seconds, duration_seconds,
		 speaker, hook, summary, category, energy_level,
		 viral_score, content_score, engagement_score,
		 thumbnail_text, thumbnail_emotion, thumbnail_timestamp,
		 suggested_caption, transcript_excerpt, enabled, status)
		VALUES
		(:id, :project_id, :clip_index, :start_seconds, :end_seconds, :duration_seconds,
		 :speaker, :hook, :summary, :category, :energy_level,
		 :viral_score, :content_score, :engagement_score,
		 :thumbnail_text, :thumbnail_emotion, :thumbnail_timestamp,
		 :suggested_caption, :transcript_excerpt, :enabled, :status)`

	for _, c := range clips {
		if _, err := r.db.NamedExec(query, c); err != nil {
			return err
		}
	}
	return nil
}

func (r *Repository) Create(c *Clip) error {
	return r.CreateBatch([]Clip{*c})
}

// clipCols selects every column, coalescing nullable TEXT columns to '' so
// scanning into Clip's string fields never fails on NULL (e.g. a clip that
// has not been generated yet has NULL raw/final/subtitle paths).
const clipCols = `
	id, project_id, clip_index, start_seconds, end_seconds, duration_seconds,
	COALESCE(speaker, '')             AS speaker,
	COALESCE(hook, '')                AS hook,
	COALESCE(summary, '')             AS summary,
	COALESCE(category, '')            AS category,
	COALESCE(energy_level, '')        AS energy_level,
	viral_score, content_score, engagement_score,
	COALESCE(thumbnail_text, '')      AS thumbnail_text,
	COALESCE(thumbnail_emotion, '')   AS thumbnail_emotion,
	thumbnail_timestamp,
	COALESCE(suggested_caption, '')   AS suggested_caption,
	COALESCE(transcript_excerpt, '')  AS transcript_excerpt,
	enabled, status,
	COALESCE(raw_clip_path, '')       AS raw_clip_path,
	COALESCE(face_data_json, '')      AS face_data_json,
	COALESCE(subtitle_path, '')       AS subtitle_path,
	COALESCE(final_clip_path, '')     AS final_clip_path,
	aspect_ratio, caption_style, caption_position, caption_size,
	COALESCE(caption_text, '')        AS caption_text,
	track_template, track_smooth, track_lock_main, track_sensitivity,
	COALESCE(waveform_path, '')       AS waveform_path,
	favorite, created_at, updated_at`

func (r *Repository) GetByProject(projectID string) ([]Clip, error) {
	var clips []Clip
	err := r.db.Select(&clips,
		"SELECT "+clipCols+" FROM clips WHERE project_id = ? ORDER BY clip_index", projectID)
	return clips, err
}

func (r *Repository) GetByID(id string) (*Clip, error) {
	var c Clip
	err := r.db.Get(&c, "SELECT "+clipCols+" FROM clips WHERE id = ?", id)
	return &c, err
}

// GalleryItem is a finished clip enriched with its source project info.
type GalleryItem struct {
	Clip
	SourceTitle string `db:"source_title" json:"source_title"`
	SourceURL   string `db:"source_url"   json:"source_url"`
}

// GetGallery returns all clips that finished rendering (status='done' and a
// final file exists), across every project, joined with the source video's
// title/url. Ordered newest project first, then clip order within a project.
func (r *Repository) GetGallery() ([]GalleryItem, error) {
	var items []GalleryItem
	err := r.db.Select(&items, `
		SELECT c.*, v.title AS source_title, v.youtube_url AS source_url
		FROM clips c
		JOIN projects p ON p.id = c.project_id
		JOIN videos v ON v.id = p.source_video_id
		WHERE c.status = 'done' AND c.final_clip_path != ''
		ORDER BY p.created_at DESC, c.clip_index ASC`)
	return items, err
}

func (r *Repository) UpdateTimestamp(id string, start, end int) error {
	_, err := r.db.Exec(
		`UPDATE clips SET start_seconds = ?, end_seconds = ?, duration_seconds = ?,
		 updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
		start, end, end-start, id)
	return err
}

func (r *Repository) SetEnabled(id string, enabled bool) error {
	_, err := r.db.Exec("UPDATE clips SET enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", enabled, id)
	return err
}

func (r *Repository) UpdateStatus(id, status string) error {
	_, err := r.db.Exec("UPDATE clips SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", status, id)
	return err
}

func (r *Repository) UpdateField(id, field string, value interface{}) error {
	_, err := r.db.Exec(
		"UPDATE clips SET "+field+" = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
		value, id)
	return err
}

func (r *Repository) UpdateFinalPath(id, path string) error {
	_, err := r.db.Exec(
		"UPDATE clips SET final_clip_path = ?, status = 'done', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
		path, id)
	return err
}

func (r *Repository) SetAspectRatio(id, ratio string) error {
	return r.UpdateField(id, "aspect_ratio", ratio)
}

func (r *Repository) SetCaptionStyle(id, style string) error {
	return r.UpdateField(id, "caption_style", style)
}

func (r *Repository) SetCaptionPosition(id, position string) error {
	return r.UpdateField(id, "caption_position", position)
}

func (r *Repository) SetCaptionSize(id, size string) error {
	return r.UpdateField(id, "caption_size", size)
}

func (r *Repository) SetCaptionText(id, text string) error {
	return r.UpdateField(id, "caption_text", text)
}

func (r *Repository) SetTrackTemplate(id, template string) error {
	return r.UpdateField(id, "track_template", template)
}

func (r *Repository) SetTrackSmooth(id string, smooth bool) error {
	v := 0
	if smooth {
		v = 1
	}
	return r.UpdateField(id, "track_smooth", v)
}

func (r *Repository) SetTrackLockMain(id string, lock bool) error {
	v := 0
	if lock {
		v = 1
	}
	return r.UpdateField(id, "track_lock_main", v)
}

func (r *Repository) SetTrackSensitivity(id string, sensitivity int) error {
	return r.UpdateField(id, "track_sensitivity", sensitivity)
}

func (r *Repository) SetWaveformPath(id, path string) error {
	return r.UpdateField(id, "waveform_path", path)
}

func (r *Repository) SetFavorite(id string, fav bool) error {
	v := 0
	if fav {
		v = 1
	}
	return r.UpdateField(id, "favorite", v)
}

func (r *Repository) GetByIDs(ids []string) ([]Clip, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	query, args, err := sqlx.In("SELECT "+clipCols+" FROM clips WHERE id IN (?)", ids)
	if err != nil {
		return nil, err
	}
	query = r.db.Rebind(query)
	var clips []Clip
	err = r.db.Select(&clips, query, args...)
	return clips, err
}

func (r *Repository) DeleteByIDs(ids []string) error {
	if len(ids) == 0 {
		return nil
	}
	query, args, err := sqlx.In("DELETE FROM clips WHERE id IN (?)", ids)
	if err != nil {
		return err
	}
	query = r.db.Rebind(query)
	_, err = r.db.Exec(query, args...)
	return err
}

func (r *Repository) Delete(id string) error {
	_, err := r.db.Exec("DELETE FROM clips WHERE id = ?", id)
	return err
}

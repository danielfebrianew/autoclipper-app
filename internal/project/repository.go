package project

import (
	"time"

	"github.com/jmoiron/sqlx"
)

type Project struct {
	ID             string    `db:"id"              json:"id"`
	YoutubeURL     string    `db:"youtube_url"     json:"youtube_url"`
	VideoID        string    `db:"video_id"        json:"video_id"`
	Title          string    `db:"title"           json:"title"`
	Duration       int       `db:"duration"        json:"duration"`
	Views          int       `db:"views"           json:"views"`
	Status         string    `db:"status"          json:"status"`
	VideoPath      string    `db:"video_path"      json:"video_path"`
	HeatmapJSON    string    `db:"heatmap_json"    json:"heatmap_json"`
	TranscriptJSON string    `db:"transcript_json" json:"transcript_json"`
	GeminiJSON     string    `db:"gemini_json"     json:"gemini_json"`
	// Source tracking (migration 006)
	SourceBytes int64  `db:"source_bytes" json:"source_bytes"`
	Channel     string `db:"channel"      json:"channel"`
	IsLocal     bool   `db:"is_local"     json:"is_local"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(p *Project) error {
	_, err := r.db.NamedExec(`INSERT INTO projects
		(id, youtube_url, video_id, title, duration, views, status, is_local)
		VALUES (:id, :youtube_url, :video_id, :title, :duration, :views, :status, :is_local)`, p)
	return err
}

// projectCols selects every column, coalescing nullable TEXT columns to ''
// so scanning into the string fields of Project never fails on NULL rows
// (e.g. a project that errored before video_path/transcript were written).
const projectCols = `
	id, youtube_url, video_id, title, duration, views, status,
	COALESCE(video_path, '')      AS video_path,
	COALESCE(heatmap_json, '')    AS heatmap_json,
	COALESCE(transcript_json, '') AS transcript_json,
	COALESCE(gemini_json, '')     AS gemini_json,
	source_bytes,
	COALESCE(channel, '')         AS channel,
	is_local, created_at, updated_at`

func (r *Repository) GetByID(id string) (*Project, error) {
	var p Project
	err := r.db.Get(&p, "SELECT "+projectCols+" FROM projects WHERE id = ?", id)
	return &p, err
}

func (r *Repository) List() ([]Project, error) {
	var projects []Project
	err := r.db.Select(&projects, "SELECT "+projectCols+" FROM projects ORDER BY created_at DESC")
	return projects, err
}

func (r *Repository) UpdateStatus(id, status string) error {
	_, err := r.db.Exec(
		"UPDATE projects SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
		status, id)
	return err
}

func (r *Repository) UpdateField(id, field string, value interface{}) error {
	_, err := r.db.Exec(
		"UPDATE projects SET "+field+" = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
		value, id)
	return err
}

func (r *Repository) Delete(id string) error {
	_, err := r.db.Exec("DELETE FROM projects WHERE id = ?", id)
	return err
}

func (r *Repository) DeleteByIDs(ids []string) error {
	if len(ids) == 0 {
		return nil
	}
	query, args, err := sqlx.In("DELETE FROM projects WHERE id IN (?)", ids)
	if err != nil {
		return err
	}
	query = r.db.Rebind(query)
	_, err = r.db.Exec(query, args...)
	return err
}

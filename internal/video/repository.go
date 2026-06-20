// Package video manages downloaded source videos. One video (single download +
// transcript + heatmap) can back many projects, each producing its own set of
// clips. Split out of the old monolithic projects table in migration 008.
package video

import (
	"time"

	"github.com/jmoiron/sqlx"
)

type Video struct {
	ID             string    `db:"id"              json:"id"`
	YoutubeURL     string    `db:"youtube_url"     json:"youtube_url"`
	VideoID        string    `db:"video_id"        json:"video_id"`
	Title          string    `db:"title"           json:"title"`
	Channel        string    `db:"channel"         json:"channel"`
	Duration       int       `db:"duration"        json:"duration"`
	Views          int       `db:"views"           json:"views"`
	VideoPath      string    `db:"video_path"      json:"video_path"`
	SourceBytes    int64     `db:"source_bytes"    json:"source_bytes"`
	HeatmapJSON    string    `db:"heatmap_json"    json:"heatmap_json"`
	TranscriptJSON string    `db:"transcript_json" json:"transcript_json"`
	IsLocal        bool      `db:"is_local"        json:"is_local"`
	Status         string    `db:"status"          json:"status"`
	CreatedAt      time.Time `db:"created_at"      json:"created_at"`
	UpdatedAt      time.Time `db:"updated_at"      json:"updated_at"`
}

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

const cols = `
	id, youtube_url, video_id,
	COALESCE(title, '')           AS title,
	COALESCE(channel, '')         AS channel,
	COALESCE(duration, 0)         AS duration,
	COALESCE(views, 0)            AS views,
	COALESCE(video_path, '')      AS video_path,
	source_bytes,
	COALESCE(heatmap_json, '')    AS heatmap_json,
	COALESCE(transcript_json, '') AS transcript_json,
	is_local, status, created_at, updated_at`

func (r *Repository) Create(v *Video) error {
	_, err := r.db.NamedExec(`INSERT INTO videos
		(id, youtube_url, video_id, title, channel, duration, views,
		 video_path, source_bytes, heatmap_json, transcript_json, is_local, status)
		VALUES (:id, :youtube_url, :video_id, :title, :channel, :duration, :views,
		        :video_path, :source_bytes, :heatmap_json, :transcript_json, :is_local, :status)`, v)
	return err
}

func (r *Repository) GetByID(id string) (*Video, error) {
	var v Video
	err := r.db.Get(&v, "SELECT "+cols+" FROM videos WHERE id = ?", id)
	return &v, err
}

// FindByURL returns the video matching a YouTube URL, or sql.ErrNoRows if none.
func (r *Repository) FindByURL(url string) (*Video, error) {
	var v Video
	err := r.db.Get(&v, "SELECT "+cols+" FROM videos WHERE youtube_url = ? ORDER BY created_at DESC LIMIT 1", url)
	return &v, err
}

// FindByVideoID looks up by the YouTube video id (more robust than full URL).
func (r *Repository) FindByVideoID(videoID string) (*Video, error) {
	var v Video
	err := r.db.Get(&v, "SELECT "+cols+" FROM videos WHERE video_id = ? ORDER BY created_at DESC LIMIT 1", videoID)
	return &v, err
}

func (r *Repository) List() ([]Video, error) {
	var vs []Video
	err := r.db.Select(&vs, "SELECT "+cols+" FROM videos ORDER BY created_at DESC")
	return vs, err
}

func (r *Repository) UpdateStatus(id, status string) error {
	_, err := r.db.Exec("UPDATE videos SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", status, id)
	return err
}

func (r *Repository) UpdateField(id, field string, value interface{}) error {
	_, err := r.db.Exec("UPDATE videos SET "+field+" = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", value, id)
	return err
}

func (r *Repository) Delete(id string) error {
	_, err := r.db.Exec("DELETE FROM videos WHERE id = ?", id)
	return err
}

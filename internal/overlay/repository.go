// Package overlay menyimpan project "overlay editor" — menempel gambar/video
// di area bawah video sumber (default 30% tinggi) plus click sound & cover.
// Data persisten di SQLite app (tabel overlay_projects / overlay_tracks /
// overlay_images), bukan server terpisah.
package overlay

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// --- Row types (db tags) ---

type projectRow struct {
	ID              string    `db:"id"`
	Name            string    `db:"name"`
	SourceVideoPath string    `db:"source_video_path"`
	SourceClipID    string    `db:"source_clip_id"`
	VideoWidth      int       `db:"video_width"`
	VideoHeight     int       `db:"video_height"`
	VideoFPS        float64   `db:"video_fps"`
	VideoDuration   float64   `db:"video_duration"`
	ImageAreaRatio  float64   `db:"image_area_ratio"`
	ImageFit        string    `db:"image_fit"`
	BackgroundColor string    `db:"background_color"`
	AspectRatio     string    `db:"aspect_ratio"`
	ClickEnabled    bool      `db:"click_enabled"`
	ClickVolume     float64   `db:"click_volume"`
	CoverPath       string    `db:"cover_path"`
	CoverDuration   float64   `db:"cover_duration"`
	CreatedAt       time.Time `db:"created_at"`
	UpdatedAt       time.Time `db:"updated_at"`
}

type trackRow struct {
	ID               string        `db:"id"`
	OverlayProjectID string        `db:"overlay_project_id"`
	Kind             string        `db:"kind"`
	AssetPath        string        `db:"asset_path"`
	AssetName        string        `db:"asset_name"`
	StartSec         float64       `db:"start_sec"`
	EndSec           float64       `db:"end_sec"`
	TrimStartSec     float64       `db:"trim_start_sec"`
	FitOverride      string        `db:"fit_override"`
	ClickEnabled     sql.NullBool  `db:"click_enabled"`
	SortOrder        int           `db:"sort_order"`
}

// --- Domain types (json tags; what bindings expose) ---

type Layout struct {
	ImageAreaRatio  float64 `json:"image_area_ratio"`
	ImageFit        string  `json:"image_fit"`
	BackgroundColor string  `json:"background_color"`
	AspectRatio     string  `json:"aspect_ratio"`
}

type Click struct {
	Enabled bool    `json:"enabled"`
	Volume  float64 `json:"volume"`
}

type Cover struct {
	Path        string  `json:"path"`
	DurationSec float64 `json:"duration_sec"`
}

type Track struct {
	ID           string  `json:"id"`
	Kind         string  `json:"kind"` // image|video
	AssetPath    string  `json:"asset_path"`
	AssetName    string  `json:"asset_name"`
	StartSec     float64 `json:"start_sec"`
	EndSec       float64 `json:"end_sec"`
	TrimStartSec float64 `json:"trim_start_sec"`
	FitOverride  string  `json:"fit_override"`
	ClickEnabled *bool   `json:"click_enabled"`
	SortOrder    int     `json:"sort_order"`
}

type Project struct {
	ID              string  `json:"id"`
	Name            string  `json:"name"`
	SourceVideoPath string  `json:"source_video_path"`
	SourceClipID    string  `json:"source_clip_id"`
	VideoWidth      int     `json:"video_width"`
	VideoHeight     int     `json:"video_height"`
	VideoFPS        float64 `json:"video_fps"`
	VideoDuration   float64 `json:"video_duration"`
	Layout          Layout  `json:"layout"`
	ClickSound      Click   `json:"click_sound"`
	Cover           *Cover  `json:"cover"`
	Tracks          []Track `json:"tracks"`
	CreatedAt       string  `json:"created_at"`
	UpdatedAt       string  `json:"updated_at"`
}

type Image struct {
	ID        string `json:"id"`
	Path      string `json:"path"`
	Name      string `json:"name"`
	Width     int    `json:"width"`
	Height    int    `json:"height"`
	CreatedAt string `json:"created_at"`
}

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- Project CRUD ---

const projectCols = `
	id, name, source_video_path,
	COALESCE(source_clip_id, '') AS source_clip_id,
	video_width, video_height, video_fps, video_duration,
	image_area_ratio, image_fit, background_color, aspect_ratio,
	click_enabled, click_volume,
	COALESCE(cover_path, '') AS cover_path, cover_duration,
	created_at, updated_at`

// CreateProject inserts a fresh overlay project with default layout/click.
func (r *Repository) CreateProject(p *Project) error {
	if p.ID == "" {
		p.ID = uuid.New().String()
	}
	if p.Layout.ImageAreaRatio == 0 {
		p.Layout.ImageAreaRatio = 0.30
	}
	if p.Layout.ImageFit == "" {
		p.Layout.ImageFit = "cover"
	}
	if p.Layout.BackgroundColor == "" {
		p.Layout.BackgroundColor = "#000000"
	}
	if p.Layout.AspectRatio == "" {
		p.Layout.AspectRatio = "9:16"
	}
	if p.ClickSound.Volume == 0 {
		p.ClickSound.Volume = 0.6
	}
	_, err := r.db.Exec(`INSERT INTO overlay_projects
		(id, name, source_video_path, source_clip_id,
		 video_width, video_height, video_fps, video_duration,
		 image_area_ratio, image_fit, background_color, aspect_ratio,
		 click_enabled, click_volume, cover_path, cover_duration)
		VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
		p.ID, p.Name, p.SourceVideoPath, nullStr(p.SourceClipID),
		p.VideoWidth, p.VideoHeight, p.VideoFPS, p.VideoDuration,
		p.Layout.ImageAreaRatio, p.Layout.ImageFit, p.Layout.BackgroundColor, p.Layout.AspectRatio,
		p.ClickSound.Enabled, p.ClickSound.Volume, coverPath(p.Cover), coverDuration(p.Cover))
	return err
}

func (r *Repository) GetProject(id string) (*Project, error) {
	var row projectRow
	if err := r.db.Get(&row, "SELECT "+projectCols+" FROM overlay_projects WHERE id = ?", id); err != nil {
		return nil, err
	}
	p := rowToProject(row)
	tracks, err := r.listTracks(id)
	if err != nil {
		return nil, err
	}
	p.Tracks = tracks
	return &p, nil
}

func (r *Repository) ListProjects() ([]Project, error) {
	var rows []projectRow
	if err := r.db.Select(&rows, "SELECT "+projectCols+" FROM overlay_projects ORDER BY updated_at DESC"); err != nil {
		return nil, err
	}
	out := make([]Project, 0, len(rows))
	for _, row := range rows {
		p := rowToProject(row)
		tracks, err := r.listTracks(p.ID)
		if err != nil {
			return nil, err
		}
		p.Tracks = tracks
		out = append(out, p)
	}
	return out, nil
}

// SaveProject persists layout/click/cover + replaces all tracks (full overwrite).
// Used by the debounced auto-save on the frontend.
func (r *Repository) SaveProject(p *Project) error {
	tx, err := r.db.Beginx()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`UPDATE overlay_projects SET
		name = ?, source_video_path = ?, source_clip_id = ?,
		video_width = ?, video_height = ?, video_fps = ?, video_duration = ?,
		image_area_ratio = ?, image_fit = ?, background_color = ?, aspect_ratio = ?,
		click_enabled = ?, click_volume = ?, cover_path = ?, cover_duration = ?,
		updated_at = CURRENT_TIMESTAMP
		WHERE id = ?`,
		p.Name, p.SourceVideoPath, nullStr(p.SourceClipID),
		p.VideoWidth, p.VideoHeight, p.VideoFPS, p.VideoDuration,
		p.Layout.ImageAreaRatio, p.Layout.ImageFit, p.Layout.BackgroundColor, p.Layout.AspectRatio,
		p.ClickSound.Enabled, p.ClickSound.Volume, coverPath(p.Cover), coverDuration(p.Cover),
		p.ID); err != nil {
		return err
	}

	if _, err := tx.Exec("DELETE FROM overlay_tracks WHERE overlay_project_id = ?", p.ID); err != nil {
		return err
	}
	for i, t := range p.Tracks {
		id := t.ID
		if id == "" {
			id = uuid.New().String()
		}
		order := t.SortOrder
		if order == 0 {
			order = i
		}
		if _, err := tx.Exec(`INSERT INTO overlay_tracks
			(id, overlay_project_id, kind, asset_path, asset_name,
			 start_sec, end_sec, trim_start_sec, fit_override, click_enabled, sort_order)
			VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
			id, p.ID, t.Kind, t.AssetPath, nullStr(t.AssetName),
			t.StartSec, t.EndSec, t.TrimStartSec, nullStr(t.FitOverride),
			nullBool(t.ClickEnabled), order); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (r *Repository) DeleteProject(id string) error {
	_, err := r.db.Exec("DELETE FROM overlay_projects WHERE id = ?", id)
	return err
}

// SetCover updates only cover fields (path may be "" to clear).
func (r *Repository) SetCover(projectID, path string, duration float64) error {
	_, err := r.db.Exec(
		"UPDATE overlay_projects SET cover_path = ?, cover_duration = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
		nullStr(path), duration, projectID)
	return err
}

func (r *Repository) listTracks(projectID string) ([]Track, error) {
	var rows []trackRow
	err := r.db.Select(&rows, `SELECT
		id, overlay_project_id, kind, asset_path,
		COALESCE(asset_name, '') AS asset_name,
		start_sec, end_sec, trim_start_sec,
		COALESCE(fit_override, '') AS fit_override,
		click_enabled, sort_order
		FROM overlay_tracks WHERE overlay_project_id = ? ORDER BY sort_order, start_sec`, projectID)
	if err != nil {
		return nil, err
	}
	out := make([]Track, 0, len(rows))
	for _, row := range rows {
		t := Track{
			ID:           row.ID,
			Kind:         row.Kind,
			AssetPath:    row.AssetPath,
			AssetName:    row.AssetName,
			StartSec:     row.StartSec,
			EndSec:       row.EndSec,
			TrimStartSec: row.TrimStartSec,
			FitOverride:  row.FitOverride,
			SortOrder:    row.SortOrder,
		}
		if row.ClickEnabled.Valid {
			v := row.ClickEnabled.Bool
			t.ClickEnabled = &v
		}
		out = append(out, t)
	}
	return out, nil
}

// --- Image library CRUD ---

func (r *Repository) CreateImage(img *Image) error {
	if img.ID == "" {
		img.ID = uuid.New().String()
	}
	_, err := r.db.Exec(`INSERT INTO overlay_images
		(id, path, name, width, height) VALUES (?,?,?,?,?)`,
		img.ID, img.Path, img.Name, img.Width, img.Height)
	return err
}

func (r *Repository) ListImages() ([]Image, error) {
	var imgs []Image
	err := r.db.Select(&imgs,
		"SELECT id, path, name, width, height, created_at FROM overlay_images WHERE deleted = 0 ORDER BY created_at DESC")
	return imgs, err
}

func (r *Repository) GetImage(id string) (*Image, error) {
	var img Image
	err := r.db.Get(&img,
		"SELECT id, path, name, width, height, created_at FROM overlay_images WHERE id = ?", id)
	return &img, err
}

// DeleteImage soft-deletes so existing tracks referencing it still resolve.
func (r *Repository) DeleteImage(id string) error {
	_, err := r.db.Exec("UPDATE overlay_images SET deleted = 1 WHERE id = ?", id)
	return err
}

// --- helpers ---

func rowToProject(row projectRow) Project {
	p := Project{
		ID:              row.ID,
		Name:            row.Name,
		SourceVideoPath: row.SourceVideoPath,
		SourceClipID:    row.SourceClipID,
		VideoWidth:      row.VideoWidth,
		VideoHeight:     row.VideoHeight,
		VideoFPS:        row.VideoFPS,
		VideoDuration:   row.VideoDuration,
		Layout: Layout{
			ImageAreaRatio:  row.ImageAreaRatio,
			ImageFit:        row.ImageFit,
			BackgroundColor: row.BackgroundColor,
			AspectRatio:     row.AspectRatio,
		},
		ClickSound: Click{Enabled: row.ClickEnabled, Volume: row.ClickVolume},
		CreatedAt:  row.CreatedAt.Format(time.RFC3339),
		UpdatedAt:  row.UpdatedAt.Format(time.RFC3339),
	}
	if row.CoverPath != "" {
		p.Cover = &Cover{Path: row.CoverPath, DurationSec: row.CoverDuration}
	}
	return p
}

func nullStr(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

func nullBool(b *bool) interface{} {
	if b == nil {
		return nil
	}
	return *b
}

func coverPath(c *Cover) interface{} {
	if c == nil || c.Path == "" {
		return nil
	}
	return c.Path
}

func coverDuration(c *Cover) float64 {
	if c == nil {
		return 0.5
	}
	return c.DurationSec
}

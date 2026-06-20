package project

import (
	"time"

	"github.com/jmoiron/sqlx"
)

// Project is a lean record: one analysis/clip-set derived from a source video.
// Source fields (url, path, transcript, …) now live in the videos table.
type Project struct {
	ID            string    `db:"id"               json:"id"`
	SourceVideoID string    `db:"source_video_id"  json:"source_video_id"`
	Name          string    `db:"name"             json:"name"`
	Status        string    `db:"status"           json:"status"`
	GeminiJSON    string    `db:"gemini_json"      json:"gemini_json"`
	CreatedAt     time.Time `db:"created_at"       json:"created_at"`
	UpdatedAt     time.Time `db:"updated_at"       json:"updated_at"`
}

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

const projectCols = `
	id, source_video_id,
	COALESCE(name, '')        AS name,
	status,
	COALESCE(gemini_json, '') AS gemini_json,
	created_at, updated_at`

func (r *Repository) Create(p *Project) error {
	_, err := r.db.NamedExec(`INSERT INTO projects
		(id, source_video_id, name, status)
		VALUES (:id, :source_video_id, :name, :status)`, p)
	return err
}

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

// ListByVideo returns all projects derived from a given source video.
func (r *Repository) ListByVideo(videoID string) ([]Project, error) {
	var projects []Project
	err := r.db.Select(&projects,
		"SELECT "+projectCols+" FROM projects WHERE source_video_id = ? ORDER BY created_at DESC", videoID)
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

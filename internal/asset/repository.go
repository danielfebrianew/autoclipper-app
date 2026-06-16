package asset

import (
	"os"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

const (
	KindThumbnail = "thumbnail"
	KindWaveform  = "waveform"
	KindFacetrack = "facetrack"
)

type Asset struct {
	ID        string    `db:"id"         json:"id"`
	ClipID    string    `db:"clip_id"    json:"clip_id"`
	ProjectID string    `db:"project_id" json:"project_id"`
	Kind      string    `db:"kind"       json:"kind"`
	Path      string    `db:"path"       json:"path"`
	SizeBytes int64     `db:"size_bytes" json:"size_bytes"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(a *Asset) error {
	if a.ID == "" {
		a.ID = uuid.New().String()
	}
	_, err := r.db.NamedExec(`INSERT INTO assets (id, clip_id, project_id, kind, path, size_bytes)
		VALUES (:id, :clip_id, :project_id, :kind, :path, :size_bytes)`, a)
	return err
}

func (r *Repository) GetByClip(clipID string) ([]Asset, error) {
	var assets []Asset
	err := r.db.Select(&assets, "SELECT * FROM assets WHERE clip_id = ?", clipID)
	return assets, err
}

func (r *Repository) GetByKind(kind string) ([]Asset, error) {
	var assets []Asset
	err := r.db.Select(&assets, "SELECT * FROM assets WHERE kind = ?", kind)
	return assets, err
}

// TotalCacheBytes sums size_bytes for thumbnail/waveform/facetrack assets.
func (r *Repository) TotalCacheBytes() (int64, error) {
	var total int64
	err := r.db.Get(&total, "SELECT COALESCE(SUM(size_bytes),0) FROM assets")
	return total, err
}

// DeleteAll removes every asset row and the files on disk.
func (r *Repository) DeleteAll() (int64, error) {
	assets, err := r.GetByKind(KindThumbnail)
	if err != nil {
		return 0, err
	}
	wf, _ := r.GetByKind(KindWaveform)
	ft, _ := r.GetByKind(KindFacetrack)
	assets = append(assets, wf...)
	assets = append(assets, ft...)

	var freed int64
	for _, a := range assets {
		freed += a.SizeBytes
		os.Remove(a.Path)
	}
	_, err = r.db.Exec("DELETE FROM assets")
	return freed, err
}

func (r *Repository) DeleteByClip(clipID string) error {
	assets, _ := r.GetByClip(clipID)
	for _, a := range assets {
		os.Remove(a.Path)
	}
	_, err := r.db.Exec("DELETE FROM assets WHERE clip_id = ?", clipID)
	return err
}

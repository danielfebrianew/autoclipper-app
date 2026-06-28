package tests

import (
	"database/sql"
	"errors"
	"testing"

	"github.com/google/uuid"

	"auto-clipper/internal/video"
)

func newVideo(id string) *video.Video {
	return &video.Video{
		ID:         id,
		YoutubeURL: "https://youtu.be/" + id,
		VideoID:    id[:11],
		Title:      "Title " + id,
		Channel:    "Chan",
		Duration:   600,
		Views:      1234,
		Status:     "ready",
	}
}

func TestVideoRepoCreateAndGet(t *testing.T) {
	repo := video.NewRepository(newTestDB(t))
	v := newVideo(uuid.New().String())

	if err := repo.Create(v); err != nil {
		t.Fatalf("Create: %v", err)
	}

	got, err := repo.GetByID(v.ID)
	if err != nil {
		t.Fatalf("GetByID: %v", err)
	}
	if got.Title != v.Title || got.Duration != 600 || got.Views != 1234 {
		t.Errorf("round-trip mismatch: %+v", got)
	}
}

func TestVideoRepoGetMissingReturnsNoRows(t *testing.T) {
	repo := video.NewRepository(newTestDB(t))
	_, err := repo.GetByID("does-not-exist")
	if !errors.Is(err, sql.ErrNoRows) {
		t.Errorf("expected sql.ErrNoRows, got %v", err)
	}
}

func TestVideoRepoFindByURLAndVideoID(t *testing.T) {
	repo := video.NewRepository(newTestDB(t))
	v := newVideo(uuid.New().String())
	if err := repo.Create(v); err != nil {
		t.Fatalf("Create: %v", err)
	}

	byURL, err := repo.FindByURL(v.YoutubeURL)
	if err != nil || byURL.ID != v.ID {
		t.Errorf("FindByURL: got %+v, err %v", byURL, err)
	}
	byVID, err := repo.FindByVideoID(v.VideoID)
	if err != nil || byVID.ID != v.ID {
		t.Errorf("FindByVideoID: got %+v, err %v", byVID, err)
	}
}

func TestVideoRepoUpdateStatusAndField(t *testing.T) {
	repo := video.NewRepository(newTestDB(t))
	v := newVideo(uuid.New().String())
	repo.Create(v)

	if err := repo.UpdateStatus(v.ID, "error"); err != nil {
		t.Fatalf("UpdateStatus: %v", err)
	}
	if err := repo.UpdateField(v.ID, "title", "Renamed"); err != nil {
		t.Fatalf("UpdateField: %v", err)
	}

	got, _ := repo.GetByID(v.ID)
	if got.Status != "error" {
		t.Errorf("Status = %q, want error", got.Status)
	}
	if got.Title != "Renamed" {
		t.Errorf("Title = %q, want Renamed", got.Title)
	}
}

func TestVideoRepoListAndDelete(t *testing.T) {
	repo := video.NewRepository(newTestDB(t))
	a, b := newVideo(uuid.New().String()), newVideo(uuid.New().String())
	repo.Create(a)
	repo.Create(b)

	list, err := repo.List()
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(list) != 2 {
		t.Fatalf("List len = %d, want 2", len(list))
	}

	if err := repo.Delete(a.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if list, _ = repo.List(); len(list) != 1 {
		t.Errorf("after delete List len = %d, want 1", len(list))
	}
}

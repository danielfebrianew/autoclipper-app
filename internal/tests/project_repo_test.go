package tests

import (
	"testing"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"

	"auto-clipper/internal/project"
	"auto-clipper/internal/video"
)

// seedVideo inserts a source video and returns its id (projects need a valid
// source_video_id because of the FK constraint).
func seedVideo(t *testing.T, db *sqlx.DB) string {
	t.Helper()
	id := uuid.New().String()
	if err := video.NewRepository(db).Create(newVideo(id)); err != nil {
		t.Fatalf("seed video: %v", err)
	}
	return id
}

func TestProjectRepoCreateAndGet(t *testing.T) {
	db := newTestDB(t)
	videoID := seedVideo(t, db)
	repo := project.NewRepository(db)

	p := &project.Project{
		ID:            uuid.New().String(),
		SourceVideoID: videoID,
		Name:          "Clip set 1",
		Status:        "ready",
	}
	if err := repo.Create(p); err != nil {
		t.Fatalf("Create: %v", err)
	}

	got, err := repo.GetByID(p.ID)
	if err != nil {
		t.Fatalf("GetByID: %v", err)
	}
	if got.Name != "Clip set 1" || got.SourceVideoID != videoID {
		t.Errorf("round-trip mismatch: %+v", got)
	}
}

func TestProjectRepoForeignKeyEnforced(t *testing.T) {
	repo := project.NewRepository(newTestDB(t))
	// source_video_id points at a non-existent video -> FK violation.
	err := repo.Create(&project.Project{
		ID:            uuid.New().String(),
		SourceVideoID: "ghost-video",
		Status:        "ready",
	})
	if err == nil {
		t.Error("expected FK constraint error for missing source video")
	}
}

func TestProjectRepoListByVideo(t *testing.T) {
	db := newTestDB(t)
	repo := project.NewRepository(db)
	v1 := seedVideo(t, db)
	v2 := seedVideo(t, db)

	for i := 0; i < 2; i++ {
		repo.Create(&project.Project{ID: uuid.New().String(), SourceVideoID: v1, Status: "ready"})
	}
	repo.Create(&project.Project{ID: uuid.New().String(), SourceVideoID: v2, Status: "ready"})

	byV1, err := repo.ListByVideo(v1)
	if err != nil {
		t.Fatalf("ListByVideo: %v", err)
	}
	if len(byV1) != 2 {
		t.Errorf("ListByVideo(v1) = %d, want 2", len(byV1))
	}
	if all, _ := repo.List(); len(all) != 3 {
		t.Errorf("List = %d, want 3", len(all))
	}
}

func TestProjectRepoUpdateAndDeleteByIDs(t *testing.T) {
	db := newTestDB(t)
	repo := project.NewRepository(db)
	videoID := seedVideo(t, db)

	a := &project.Project{ID: uuid.New().String(), SourceVideoID: videoID, Status: "ready"}
	b := &project.Project{ID: uuid.New().String(), SourceVideoID: videoID, Status: "ready"}
	repo.Create(a)
	repo.Create(b)

	if err := repo.UpdateStatus(a.ID, "error"); err != nil {
		t.Fatalf("UpdateStatus: %v", err)
	}
	if got, _ := repo.GetByID(a.ID); got.Status != "error" {
		t.Errorf("Status = %q, want error", got.Status)
	}

	if err := repo.DeleteByIDs([]string{a.ID, b.ID}); err != nil {
		t.Fatalf("DeleteByIDs: %v", err)
	}
	if all, _ := repo.List(); len(all) != 0 {
		t.Errorf("after DeleteByIDs List = %d, want 0", len(all))
	}

	// Empty slice is a no-op, not an error.
	if err := repo.DeleteByIDs(nil); err != nil {
		t.Errorf("DeleteByIDs(nil) = %v, want nil", err)
	}
}

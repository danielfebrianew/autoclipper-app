package tests

import (
	"testing"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"

	"auto-clipper/internal/clip"
	"auto-clipper/internal/project"
	"auto-clipper/internal/video"
)

// seedProject inserts video -> project and returns the project id, satisfying
// the clips.project_id FK.
func seedProject(t *testing.T, db *sqlx.DB) string {
	t.Helper()
	vid := uuid.New().String()
	if err := video.NewRepository(db).Create(newVideo(vid)); err != nil {
		t.Fatalf("seed video: %v", err)
	}
	pid := uuid.New().String()
	if err := project.NewRepository(db).Create(&project.Project{
		ID: pid, SourceVideoID: vid, Status: "ready",
	}); err != nil {
		t.Fatalf("seed project: %v", err)
	}
	return pid
}

func newClip(projectID string, idx, start, end int) clip.Clip {
	return clip.Clip{
		ID:              uuid.New().String(),
		ProjectID:       projectID,
		ClipIndex:       idx,
		StartSeconds:    start,
		EndSeconds:      end,
		DurationSeconds: end - start,
		ViralScore:      8.5,
		Enabled:         true,
		Status:          "pending",
	}
}

func TestClipRepoCreateBatchAndGetByProject(t *testing.T) {
	db := newTestDB(t)
	pid := seedProject(t, db)
	repo := clip.NewRepository(db)

	// Insert out of index order; GetByProject must return them ordered by clip_index.
	clips := []clip.Clip{
		newClip(pid, 2, 30, 60),
		newClip(pid, 1, 0, 20),
		newClip(pid, 3, 70, 90),
	}
	if err := repo.CreateBatch(clips); err != nil {
		t.Fatalf("CreateBatch: %v", err)
	}

	got, err := repo.GetByProject(pid)
	if err != nil {
		t.Fatalf("GetByProject: %v", err)
	}
	if len(got) != 3 {
		t.Fatalf("len = %d, want 3", len(got))
	}
	if got[0].ClipIndex != 1 || got[1].ClipIndex != 2 || got[2].ClipIndex != 3 {
		t.Errorf("not ordered by clip_index: %d,%d,%d", got[0].ClipIndex, got[1].ClipIndex, got[2].ClipIndex)
	}
}

func TestClipRepoUpdateTimestampRecomputesDuration(t *testing.T) {
	db := newTestDB(t)
	pid := seedProject(t, db)
	repo := clip.NewRepository(db)

	c := newClip(pid, 1, 0, 20)
	repo.Create(&c)

	if err := repo.UpdateTimestamp(c.ID, 10, 45); err != nil {
		t.Fatalf("UpdateTimestamp: %v", err)
	}
	got, _ := repo.GetByID(c.ID)
	if got.StartSeconds != 10 || got.EndSeconds != 45 {
		t.Errorf("timestamps = (%d,%d), want (10,45)", got.StartSeconds, got.EndSeconds)
	}
	if got.DurationSeconds != 35 {
		t.Errorf("duration = %d, want 35 (end-start)", got.DurationSeconds)
	}
}

func TestClipRepoEnabledAndFavoriteFlags(t *testing.T) {
	db := newTestDB(t)
	pid := seedProject(t, db)
	repo := clip.NewRepository(db)

	c := newClip(pid, 1, 0, 20)
	repo.Create(&c)

	repo.SetEnabled(c.ID, false)
	repo.SetFavorite(c.ID, true)

	got, _ := repo.GetByID(c.ID)
	if got.Enabled {
		t.Error("Enabled should be false")
	}
	if !got.Favorite {
		t.Error("Favorite should be true")
	}
}

func TestClipRepoDeleteByIDs(t *testing.T) {
	db := newTestDB(t)
	pid := seedProject(t, db)
	repo := clip.NewRepository(db)

	a := newClip(pid, 1, 0, 20)
	b := newClip(pid, 2, 20, 40)
	repo.CreateBatch([]clip.Clip{a, b})

	if err := repo.DeleteByIDs([]string{a.ID}); err != nil {
		t.Fatalf("DeleteByIDs: %v", err)
	}
	got, _ := repo.GetByProject(pid)
	if len(got) != 1 || got[0].ID != b.ID {
		t.Errorf("after delete: %+v", got)
	}
}

// Full chain: video -> project -> clip, then GetGallery joins all three and
// returns only finished clips with source title/url populated.
func TestClipRepoGalleryJoinsSource(t *testing.T) {
	db := newTestDB(t)

	vid := uuid.New().String()
	v := newVideo(vid)
	v.Title = "Source Show"
	video.NewRepository(db).Create(v)

	pid := uuid.New().String()
	project.NewRepository(db).Create(&project.Project{ID: pid, SourceVideoID: vid, Status: "ready"})

	repo := clip.NewRepository(db)
	done := newClip(pid, 1, 0, 20)
	pending := newClip(pid, 2, 20, 40)
	repo.CreateBatch([]clip.Clip{done, pending})

	// Only `done` clip finished rendering with a final path.
	if err := repo.UpdateFinalPath(done.ID, "/out/done.mp4"); err != nil {
		t.Fatalf("UpdateFinalPath: %v", err)
	}

	gallery, err := repo.GetGallery()
	if err != nil {
		t.Fatalf("GetGallery: %v", err)
	}
	if len(gallery) != 1 {
		t.Fatalf("gallery len = %d, want 1 (only finished clips)", len(gallery))
	}
	item := gallery[0]
	if item.ID != done.ID {
		t.Errorf("gallery item id = %q, want %q", item.ID, done.ID)
	}
	if item.SourceTitle != "Source Show" {
		t.Errorf("SourceTitle = %q, want 'Source Show' (joined from videos)", item.SourceTitle)
	}
	if item.Status != "done" || item.FinalClipPath != "/out/done.mp4" {
		t.Errorf("unexpected status/path: %q %q", item.Status, item.FinalClipPath)
	}
}

// Deleting a project should cascade to its clips if the FK is ON DELETE CASCADE,
// or be blocked otherwise — either way the clips table stays consistent.
func TestClipRepoProjectFKConsistency(t *testing.T) {
	db := newTestDB(t)
	pid := seedProject(t, db)
	repo := clip.NewRepository(db)

	c := newClip(pid, 1, 0, 20)
	repo.Create(&c)

	err := project.NewRepository(db).Delete(pid)
	// We don't assert cascade vs. restrict here (schema-dependent); we just
	// require the operation not to leave a dangling, fetchable clip when it
	// succeeds.
	if err == nil {
		if got, _ := repo.GetByProject(pid); len(got) != 0 {
			t.Errorf("clips not cascaded after project delete: %d remain", len(got))
		}
	}
}

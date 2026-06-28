package tests

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/jmoiron/sqlx"

	"auto-clipper/internal/database"
)

func init() {
	// Silence zerolog noise (database.New logs on init).
	os.Setenv("ZEROLOG_LEVEL", "disabled")
}

// newTestDB spins up a real, fully-migrated SQLite database in a temp dir and
// returns it. Foreign keys are enforced (see database.New), so callers must
// insert video -> project -> clip in dependency order.
func newTestDB(t *testing.T) *sqlx.DB {
	t.Helper()
	dbPath := filepath.Join(t.TempDir(), "test.db")
	migrationsPath, err := filepath.Abs("../../migrations")
	if err != nil {
		t.Fatalf("resolve migrations path: %v", err)
	}
	db, err := database.New(dbPath, migrationsPath)
	if err != nil {
		t.Fatalf("database.New: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	return db
}

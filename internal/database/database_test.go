package database

import (
	"os"
	"path/filepath"
	"testing"
)

func TestNew(t *testing.T) {
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "test.db")
	migrationsPath, err := filepath.Abs("../../migrations")
	if err != nil {
		t.Fatal(err)
	}

	db, err := New(dbPath, migrationsPath)
	if err != nil {
		t.Fatalf("New() error: %v", err)
	}
	defer db.Close()

	// Verify tables exist
	tables := []string{"settings", "projects", "clips"}
	for _, table := range tables {
		var name string
		err := db.QueryRow("SELECT name FROM sqlite_master WHERE type='table' AND name=?", table).Scan(&name)
		if err != nil {
			t.Errorf("table %q not found: %v", table, err)
		}
	}
}

func TestNewIdempotent(t *testing.T) {
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "test.db")
	migrationsPath, _ := filepath.Abs("../../migrations")

	// Run twice — migrations should not fail on second run
	for i := 0; i < 2; i++ {
		db, err := New(dbPath, migrationsPath)
		if err != nil {
			t.Fatalf("New() run %d error: %v", i+1, err)
		}
		db.Close()
	}
}

func init() {
	// suppress logger output in tests
	os.Setenv("ZEROLOG_LEVEL", "disabled")
}

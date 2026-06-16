CREATE TABLE IF NOT EXISTS assets (
    id          TEXT PRIMARY KEY,
    clip_id     TEXT REFERENCES clips(id) ON DELETE CASCADE,
    project_id  TEXT REFERENCES projects(id) ON DELETE CASCADE,
    kind        TEXT NOT NULL,
    path        TEXT NOT NULL,
    size_bytes  INTEGER NOT NULL DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_assets_clip ON assets(clip_id);
CREATE INDEX IF NOT EXISTS idx_assets_kind ON assets(kind);

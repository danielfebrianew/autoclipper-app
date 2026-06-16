CREATE TABLE IF NOT EXISTS projects (
    id           TEXT PRIMARY KEY,
    youtube_url  TEXT NOT NULL,
    video_id     TEXT NOT NULL,
    title        TEXT,
    duration     INTEGER,
    views        INTEGER,
    status       TEXT NOT NULL DEFAULT 'pending',
    video_path   TEXT,
    heatmap_json TEXT,
    transcript_json TEXT,
    gemini_json  TEXT,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

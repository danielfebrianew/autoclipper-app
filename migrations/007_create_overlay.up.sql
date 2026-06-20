CREATE TABLE IF NOT EXISTS overlay_projects (
    id                 TEXT PRIMARY KEY,
    name               TEXT NOT NULL,
    source_video_path  TEXT NOT NULL,
    source_clip_id     TEXT,
    video_width        INTEGER NOT NULL,
    video_height       INTEGER NOT NULL,
    video_fps          REAL NOT NULL,
    video_duration     REAL NOT NULL,
    -- layout
    image_area_ratio   REAL NOT NULL DEFAULT 0.30,
    image_fit          TEXT NOT NULL DEFAULT 'cover',
    background_color   TEXT NOT NULL DEFAULT '#000000',
    aspect_ratio       TEXT NOT NULL DEFAULT '9:16',
    -- click sound
    click_enabled      INTEGER NOT NULL DEFAULT 1,
    click_volume       REAL NOT NULL DEFAULT 0.6,
    -- cover
    cover_path         TEXT,
    cover_duration     REAL NOT NULL DEFAULT 0.5,
    created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at         DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS overlay_tracks (
    id                 TEXT PRIMARY KEY,
    overlay_project_id TEXT NOT NULL REFERENCES overlay_projects(id) ON DELETE CASCADE,
    kind               TEXT NOT NULL,
    asset_path         TEXT NOT NULL,
    asset_name         TEXT,
    start_sec          REAL NOT NULL,
    end_sec            REAL NOT NULL,
    trim_start_sec     REAL NOT NULL DEFAULT 0,
    fit_override       TEXT,
    click_enabled      INTEGER,
    sort_order         INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_overlay_tracks_project ON overlay_tracks(overlay_project_id);

CREATE TABLE IF NOT EXISTS overlay_images (
    id          TEXT PRIMARY KEY,
    path        TEXT NOT NULL,
    name        TEXT NOT NULL,
    width       INTEGER NOT NULL,
    height      INTEGER NOT NULL,
    deleted     INTEGER NOT NULL DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

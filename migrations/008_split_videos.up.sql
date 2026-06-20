-- Split the monolithic `projects` table into `videos` (download source) and a
-- lean `projects` (one set of clips derived from a video). One video : many
-- projects.

CREATE TABLE IF NOT EXISTS videos (
    id              TEXT PRIMARY KEY,
    youtube_url     TEXT NOT NULL,
    video_id        TEXT NOT NULL,            -- YouTube video id (string)
    title           TEXT,
    channel         TEXT,
    duration        INTEGER,
    views           INTEGER,
    video_path      TEXT,
    source_bytes    INTEGER NOT NULL DEFAULT 0,
    heatmap_json    TEXT,
    transcript_json TEXT,
    is_local        INTEGER NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'pending',  -- download/transcript status
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_videos_video_id ON videos(video_id);
CREATE INDEX IF NOT EXISTS idx_videos_url ON videos(youtube_url);

-- Backfill: each old project row becomes one video.
INSERT INTO videos (id, youtube_url, video_id, title, channel, duration, views,
                    video_path, source_bytes, heatmap_json, transcript_json,
                    is_local, status, created_at, updated_at)
SELECT id, youtube_url, video_id, title, channel, duration, views,
       video_path, source_bytes, heatmap_json, transcript_json,
       is_local, status, created_at, updated_at
FROM projects;

-- Rebuild projects as a lean table referencing videos. Each existing project
-- maps 1:1 to the video created above (same id reused as source_video_id).
CREATE TABLE projects_new (
    id              TEXT PRIMARY KEY,
    source_video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    name            TEXT,
    status          TEXT NOT NULL DEFAULT 'pending',  -- analysis/generation status
    gemini_json     TEXT,                              -- per-project AI clip analysis
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO projects_new (id, source_video_id, name, status, gemini_json, created_at, updated_at)
SELECT id, id, title, status, gemini_json, created_at, updated_at
FROM projects;

DROP TABLE projects;
ALTER TABLE projects_new RENAME TO projects;

CREATE INDEX IF NOT EXISTS idx_projects_video ON projects(source_video_id);

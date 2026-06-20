-- Reverse the video/project split: fold videos back into a monolithic projects.

CREATE TABLE projects_old (
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
    source_bytes INTEGER NOT NULL DEFAULT 0,
    channel      TEXT,
    is_local     INTEGER NOT NULL DEFAULT 0,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO projects_old (id, youtube_url, video_id, title, duration, views, status,
                          video_path, heatmap_json, transcript_json, gemini_json,
                          source_bytes, channel, is_local, created_at, updated_at)
SELECT p.id, v.youtube_url, v.video_id, v.title, v.duration, v.views, p.status,
       v.video_path, v.heatmap_json, v.transcript_json, p.gemini_json,
       v.source_bytes, v.channel, v.is_local, p.created_at, p.updated_at
FROM projects p JOIN videos v ON v.id = p.source_video_id;

DROP TABLE projects;
ALTER TABLE projects_old RENAME TO projects;

DROP INDEX IF EXISTS idx_videos_video_id;
DROP INDEX IF EXISTS idx_videos_url;
DROP TABLE IF EXISTS videos;

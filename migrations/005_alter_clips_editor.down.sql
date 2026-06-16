-- SQLite does not support DROP COLUMN before 3.35; recreate table to reverse.
-- For simplicity, leave as no-op since migrations are append-only in dev.
SELECT 1;

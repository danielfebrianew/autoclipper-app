ALTER TABLE clips ADD COLUMN track_reserve_bottom INTEGER NOT NULL DEFAULT 0;

-- Fold removed track templates into the two supported ones.
UPDATE clips SET track_template = 'single' WHERE track_template NOT IN ('single', 'dual');

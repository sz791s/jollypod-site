ALTER TABLE share_links
ADD COLUMN expires_at INTEGER NOT NULL DEFAULT 0;

UPDATE share_links
SET expires_at = created_at + 2592000;

CREATE INDEX share_links_expires_at ON share_links (expires_at);

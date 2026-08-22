CREATE TABLE share_links (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 8 AND 32),
    identity_key TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL CHECK (kind IN ('episode', 'podcast')),
    feed_url TEXT NOT NULL,
    guid TEXT,
    enclosure_url TEXT,
    podcast_title TEXT NOT NULL,
    podcast_author TEXT,
    podcast_webpage_url TEXT,
    episode_title TEXT,
    episode_webpage_url TEXT,
    published_at INTEGER,
    duration_seconds INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    CHECK (
        (
            kind = 'podcast'
            AND guid IS NULL
            AND enclosure_url IS NULL
            AND episode_title IS NULL
            AND episode_webpage_url IS NULL
            AND published_at IS NULL
            AND duration_seconds IS NULL
        )
        OR
        (kind = 'episode' AND episode_title IS NOT NULL AND (guid IS NOT NULL OR enclosure_url IS NOT NULL))
    )
) STRICT;

CREATE INDEX share_links_kind_id ON share_links (kind, id);

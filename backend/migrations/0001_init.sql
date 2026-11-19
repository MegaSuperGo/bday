-- OPERATION: BIRTHDAY – initial schema

CREATE TABLE guests (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name       TEXT    NOT NULL,
  -- normalised name used for identification (lowercase, umlauts folded)
  name_key         TEXT    NOT NULL UNIQUE,
  progress         INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  furthest_section TEXT,
  started_at       TEXT,
  completed_at     TEXT,
  last_activity_at TEXT,
  created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- One row per device/browser a guest identified from. Only a hash of the token is stored.
CREATE TABLE briefing_sessions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  guest_id     INTEGER NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  token_hash   TEXT    NOT NULL UNIQUE,
  created_at   TEXT    NOT NULL,
  last_seen_at TEXT    NOT NULL,
  expires_at   TEXT    NOT NULL
);
CREATE INDEX idx_briefing_sessions_guest ON briefing_sessions(guest_id);

-- Counts chatbot usage. Message contents are intentionally NOT stored.
CREATE TABLE chat_usage (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  guest_id          INTEGER NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  created_at        TEXT    NOT NULL,
  model             TEXT    NOT NULL,
  prompt_tokens     INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_chat_usage_guest_time ON chat_usage(guest_id, created_at);

-- Key/value JSON documents ("event", "ai").
CREATE TABLE event_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- AES-GCM encrypted secrets (e.g. the Groq API key). Key lives in Worker Secrets.
CREATE TABLE encrypted_secrets (
  name       TEXT PRIMARY KEY,
  iv         TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE admin_sessions (
  token_hash TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX idx_admin_sessions_expiry ON admin_sessions(expires_at);

-- Fixed-window rate limit counters. Keys contain hashed identifiers only.
CREATE TABLE rate_limits (
  key          TEXT    NOT NULL,
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL,
  PRIMARY KEY (key, window_start)
);

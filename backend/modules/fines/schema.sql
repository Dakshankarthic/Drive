CREATE TABLE IF NOT EXISTS fines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  offence_code TEXT NOT NULL,
  vehicle_class TEXT NOT NULL,
  state TEXT NOT NULL,
  amount_inr INTEGER NOT NULL,
  repeat_amount_inr INTEGER,
  section_ref TEXT,
  source_url TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  version_hash TEXT NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_lookup ON fines(offence_code, vehicle_class, state);

CREATE TABLE IF NOT EXISTS sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
  source_url TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  rows_inserted INTEGER DEFAULT 0,
  rows_updated INTEGER DEFAULT 0
);

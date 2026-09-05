CREATE TABLE IF NOT EXISTS ugc_inquiries (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'NEW_INQUIRY',
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT NOT NULL,
  company_url TEXT NOT NULL,
  phone TEXT,
  preferred_contact TEXT,
  product_name TEXT NOT NULL,
  product_url TEXT NOT NULL,
  content_types_json TEXT NOT NULL,
  video_count TEXT NOT NULL,
  completion_window TEXT NOT NULL,
  budget TEXT NOT NULL,
  usage_locations_json TEXT NOT NULL,
  usage_kind TEXT NOT NULL,
  objective TEXT NOT NULL,
  notes TEXT,
  marketing_consent INTEGER NOT NULL DEFAULT 0,
  owner TEXT,
  qualification_json TEXT NOT NULL DEFAULT '{}',
  approval_decision_json TEXT NOT NULL DEFAULT '{}',
  production_clearance_json TEXT NOT NULL DEFAULT '{}',
  abuse_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ugc_project_tokens (
  id TEXT PRIMARY KEY,
  inquiry_id TEXT REFERENCES ugc_inquiries(id),
  project_ref TEXT NOT NULL,
  creation_key TEXT NOT NULL UNIQUE,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  opened_at TEXT,
  completed_at TEXT,
  proposal_snapshot_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ugc_project_briefs (
  project_token_id TEXT PRIMARY KEY REFERENCES ugc_project_tokens(id),
  revision INTEGER NOT NULL DEFAULT 1,
  draft_json TEXT NOT NULL DEFAULT '{}',
  completeness_json TEXT NOT NULL DEFAULT '{}',
  conflicts_json TEXT NOT NULL DEFAULT '[]',
  asset_inventory_json TEXT NOT NULL DEFAULT '[]',
  vantage_packet_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'DRAFT',
  submitted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ugc_notification_outbox (
  id TEXT PRIMARY KEY,
  intent_key TEXT NOT NULL UNIQUE,
  notification_type TEXT NOT NULL,
  recipient_ref TEXT NOT NULL,
  template_data_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PREVIEW',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ugc_integration_outbox (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  lease_until TEXT,
  acknowledged_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ugc_rate_windows (
  abuse_key TEXT NOT NULL,
  window_start TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(abuse_key, window_start)
);

CREATE TABLE IF NOT EXISTS ugc_audit_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  subject_id TEXT,
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ugc_status_history (
  id TEXT PRIMARY KEY,
  inquiry_id TEXT NOT NULL REFERENCES ugc_inquiries(id),
  status TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ugc_inquiries_status ON ugc_inquiries(status, created_at);
CREATE INDEX IF NOT EXISTS idx_ugc_inquiries_owner ON ugc_inquiries(owner, created_at);
CREATE INDEX IF NOT EXISTS idx_ugc_projects_status ON ugc_project_tokens(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_ugc_outbox_status ON ugc_integration_outbox(status, created_at);

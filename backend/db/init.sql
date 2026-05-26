CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  password_hash TEXT NOT NULL,
  token_version INTEGER NOT NULL DEFAULT 0,
  role VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_users_role_status
  ON users (role, status);

CREATE TABLE IF NOT EXISTS predictions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  input JSONB NOT NULL,
  predicted_price DOUBLE PRECISION NOT NULL,
  currency VARCHAR(10) NOT NULL,
  model_name VARCHAR(100) NOT NULL,
  model_version VARCHAR(50) NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE predictions
  ADD COLUMN IF NOT EXISTS note TEXT;

CREATE INDEX IF NOT EXISTS idx_predictions_user_created_at
  ON predictions (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS dataset_versions (
  id UUID PRIMARY KEY,
  file_name VARCHAR(255) NOT NULL,
  stored_file_path TEXT NOT NULL,
  source_type VARCHAR(30) NOT NULL,
  status VARCHAR(30) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  rows_count INTEGER NOT NULL DEFAULT 0,
  columns_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  preview_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  city_distribution JSONB NOT NULL DEFAULT '{}'::jsonb,
  room_distribution JSONB NOT NULL DEFAULT '{}'::jsonb,
  uploaded_by UUID REFERENCES users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_dataset_versions_created_at
  ON dataset_versions (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dataset_versions_is_active
  ON dataset_versions (is_active, created_at DESC);

CREATE TABLE IF NOT EXISTS training_jobs (
  id UUID PRIMARY KEY,
  dataset_version_id UUID NOT NULL REFERENCES dataset_versions (id) ON DELETE CASCADE,
  created_by UUID REFERENCES users (id) ON DELETE SET NULL,
  status VARCHAR(30) NOT NULL,
  stage VARCHAR(50) NOT NULL,
  model_name VARCHAR(100),
  model_version VARCHAR(100),
  metrics JSONB,
  artifacts_dir TEXT,
  processed_dataset_path TEXT,
  feature_manifest_path TEXT,
  log_output TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_training_jobs_created_at
  ON training_jobs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_training_jobs_status
  ON training_jobs (status, created_at DESC);

CREATE TABLE IF NOT EXISTS model_applications (
  id UUID PRIMARY KEY,
  training_job_id UUID NOT NULL REFERENCES training_jobs (id) ON DELETE CASCADE,
  applied_by UUID REFERENCES users (id) ON DELETE SET NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_model_applications_applied_at
  ON model_applications (applied_at DESC);

CREATE INDEX IF NOT EXISTS idx_model_applications_training_job_id
  ON model_applications (training_job_id, applied_at DESC);

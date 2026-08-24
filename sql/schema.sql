CREATE TABLE IF NOT EXISTS models (
  id BIGSERIAL PRIMARY KEY,
  model_code VARCHAR(100) NOT NULL UNIQUE,
  model_name VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS parts (
  id BIGSERIAL PRIMARY KEY,
  model_id BIGINT NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  part_code VARCHAR(100) NOT NULL,
  part_name VARCHAR(255) NOT NULL,
  machine_code VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (model_id, part_code)
);

CREATE TABLE IF NOT EXISTS condition_template_items (
  id BIGSERIAL PRIMARY KEY,
  part_id BIGINT NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
  item_no INTEGER NOT NULL CHECK (item_no > 0),
  condition_group VARCHAR(150) NOT NULL,
  topic VARCHAR(255) NOT NULL,
  standard_value TEXT,
  input_type VARCHAR(30) NOT NULL DEFAULT 'text',
  unit VARCHAR(50),
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (part_id, item_no)
);

CREATE TABLE IF NOT EXISTS condition_records (
  id BIGSERIAL PRIMARY KEY,
  record_no VARCHAR(80) NOT NULL UNIQUE,
  model_id BIGINT NOT NULL REFERENCES models(id),
  part_id BIGINT NOT NULL REFERENCES parts(id),
  record_date DATE NOT NULL DEFAULT CURRENT_DATE,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  machine_code VARCHAR(100),
  shift VARCHAR(50),
  recorder_name VARCHAR(255),
  recorder_code VARCHAR(100),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS condition_record_items (
  id BIGSERIAL PRIMARY KEY,
  record_id BIGINT NOT NULL REFERENCES condition_records(id) ON DELETE CASCADE,
  template_item_id BIGINT REFERENCES condition_template_items(id),
  item_no INTEGER NOT NULL,
  condition_group VARCHAR(150) NOT NULL,
  topic VARCHAR(255) NOT NULL,
  standard_value TEXT,
  actual_value TEXT,
  validation_status VARCHAR(20),
  validation_message TEXT,
  unit VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (record_id, item_no)
);

ALTER TABLE condition_record_items
  ADD COLUMN IF NOT EXISTS validation_status VARCHAR(20);

ALTER TABLE condition_record_items
  ADD COLUMN IF NOT EXISTS validation_message TEXT;

CREATE INDEX IF NOT EXISTS idx_parts_model ON parts(model_id);
CREATE INDEX IF NOT EXISTS idx_template_part ON condition_template_items(part_id, item_no);
CREATE INDEX IF NOT EXISTS idx_records_model_part_date ON condition_records(model_id, part_id, record_date DESC);
CREATE INDEX IF NOT EXISTS idx_record_items_record ON condition_record_items(record_id, item_no);

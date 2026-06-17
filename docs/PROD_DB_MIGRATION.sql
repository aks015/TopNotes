-- ============================================================
--  TopNotes — production schema migration
--  Adds the tables & columns introduced by:
--    • per-category seller qualification
--    • admin taxonomy (Category → Exam → Subject)
--    • landing CMS + platform config
--    • taxonomy denormalisation on notes
--
--  Run ONCE against the production MySQL database.
--  New tables use IF NOT EXISTS (safe to re-run).
--  The ALTER ... ADD COLUMN statements will error if a column
--  already exists — in that case just skip that single line.
--
--  After running this, restart the backend: the seeders populate
--  the taxonomy / platform_config / grandfather qualifications, and
--  site_content seeds on the first GET /content/landing.
-- ============================================================

-- ── 1. Taxonomy ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exam_categories (
  id            BIGINT       NOT NULL AUTO_INCREMENT,
  active        BIT(1)       NOT NULL,
  display_order INT          NOT NULL,
  name          VARCHAR(100) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_exam_category_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS exams (
  id            BIGINT       NOT NULL AUTO_INCREMENT,
  active        BIT(1)       NOT NULL,
  display_order INT          NOT NULL,
  name          VARCHAR(120) NOT NULL,
  category_id   BIGINT       NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_exam_cat_name (category_id, name),
  CONSTRAINT fk_exam_category FOREIGN KEY (category_id) REFERENCES exam_categories (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subjects (
  id            BIGINT       NOT NULL AUTO_INCREMENT,
  active        BIT(1)       NOT NULL,
  display_order INT          NOT NULL,
  name          VARCHAR(120) NOT NULL,
  exam_id       BIGINT       NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_subject_exam_name (exam_id, name),
  CONSTRAINT fk_subject_exam FOREIGN KEY (exam_id) REFERENCES exams (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 2. Per-category seller qualification ────────────────────
CREATE TABLE IF NOT EXISTS seller_qualifications (
  id               BIGINT NOT NULL AUTO_INCREMENT,
  approved_at      DATETIME(6) DEFAULT NULL,
  attempts_used    INT    NOT NULL,
  best_score       INT    NOT NULL,
  created_at       DATETIME(6) NOT NULL,
  last_attempt_at  DATETIME(6) DEFAULT NULL,
  marksheet_url    TEXT,
  rejection_reason TEXT,
  status           ENUM('TEST_FAILED','AWAITING_MARKSHEET','PENDING_REVIEW','APPROVED','REJECTED') NOT NULL,
  updated_at       DATETIME(6) NOT NULL,
  category_id      BIGINT NOT NULL,
  seller_id        BIGINT NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sq_seller_category (seller_id, category_id),
  KEY idx_sq_seller (seller_id),
  KEY idx_sq_status (status),
  CONSTRAINT fk_sq_seller   FOREIGN KEY (seller_id)   REFERENCES users (id),
  CONSTRAINT fk_sq_category FOREIGN KEY (category_id) REFERENCES exam_categories (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 3. Landing CMS + platform config ────────────────────────
CREATE TABLE IF NOT EXISTS site_content (
  page_key   VARCHAR(50) NOT NULL,
  content    TEXT,
  updated_at DATETIME(6) DEFAULT NULL,
  PRIMARY KEY (page_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS platform_config (
  id           BIGINT       NOT NULL AUTO_INCREMENT,
  config_key   VARCHAR(100) NOT NULL,
  config_value TEXT         NOT NULL,
  description  VARCHAR(350) DEFAULT NULL,
  updated_at   DATETIME(6)  DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_config_key (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 4. New columns on existing tables ───────────────────────
--  (skip any line whose column already exists)

-- Taxonomy denormalised onto notes (category + exam are new;
-- `subject` may already exist on older schemas — skip if so).
ALTER TABLE notes ADD COLUMN category VARCHAR(100) NULL;
ALTER TABLE notes ADD COLUMN exam     VARCHAR(120) NULL;
ALTER TABLE notes ADD COLUMN subject  VARCHAR(100) NULL;

-- Per-category test configuration (NULL = the Default/General config).
ALTER TABLE test_config
  ADD COLUMN category_id BIGINT NULL,
  ADD CONSTRAINT fk_testconfig_category FOREIGN KEY (category_id) REFERENCES exam_categories (id);

-- Per-category questions (NULL category_id = shared "General" pool).
ALTER TABLE test_questions
  ADD COLUMN category_id BIGINT NULL,
  ADD CONSTRAINT fk_testq_category FOREIGN KEY (category_id) REFERENCES exam_categories (id);

-- Which category each test attempt was for.
ALTER TABLE verification_tests
  ADD COLUMN category_id BIGINT NULL,
  ADD CONSTRAINT fk_verif_category FOREIGN KEY (category_id) REFERENCES exam_categories (id);

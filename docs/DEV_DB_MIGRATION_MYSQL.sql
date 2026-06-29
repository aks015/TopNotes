-- ============================================================
--  TopNotes — LOCAL DEV (MySQL) explicit migration
--  for the feat/marketplace-enhancements branch.
--
--  Hibernate (ddl-auto=update) USUALLY adds these automatically on startup,
--  but it can't:
--    • add a value to an existing ENUM column (notes.status), and
--    • it may skip adding users.email_verified on some setups
--      → causes "Unknown column 'email_verified'" on every user query.
--
--  This script is idempotent — safe to run once before/after starting the app.
--  Run:
--    docker exec -i topnotes-mysql mysql -uroot -proot topnotes_db < docs/DEV_DB_MIGRATION_MYSQL.sql
--  (or paste into any MySQL client connected to topnotes_db)
-- ============================================================

-- ── 1. users.email_verified (add only if missing) ───────────
SET @has_col := (SELECT COUNT(*) FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE()
                   AND TABLE_NAME = 'users'
                   AND COLUMN_NAME = 'email_verified');
SET @sql := IF(@has_col = 0,
               'ALTER TABLE users ADD COLUMN email_verified BIT NOT NULL DEFAULT 0',
               'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Optional: grandfather existing accounts as verified (so they aren't nagged).
UPDATE users SET email_verified = 1;

-- ── 2. New tables (created only if missing) ─────────────────
CREATE TABLE IF NOT EXISTS agreement_documents (
  id           BIGINT NOT NULL AUTO_INCREMENT,
  type         ENUM('SELLER_AGREEMENT','ORIGINALITY_DECLARATION') NOT NULL,
  version      INT NOT NULL,
  title        VARCHAR(200) NOT NULL,
  body         TEXT NOT NULL,
  content_hash VARCHAR(64) NOT NULL,
  active       BIT NOT NULL,
  created_at   DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_agreement_type_version (type, version)
);

CREATE TABLE IF NOT EXISTS consent_records (
  id             BIGINT NOT NULL AUTO_INCREMENT,
  user_id        BIGINT NOT NULL,
  agreement_type ENUM('SELLER_AGREEMENT','ORIGINALITY_DECLARATION') NOT NULL,
  version        INT NOT NULL,
  content_hash   VARCHAR(64) NOT NULL,
  note_id        BIGINT NULL,
  ip_address     VARCHAR(45) NULL,
  user_agent     VARCHAR(512) NULL,
  accepted_at    DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_consent_user_type (user_id, agreement_type),
  KEY idx_consent_note (note_id),
  CONSTRAINT fk_consent_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id          BIGINT NOT NULL AUTO_INCREMENT,
  code_hash   VARCHAR(255) NOT NULL,
  expires_at  DATETIME(6) NOT NULL,
  consumed_at DATETIME(6) NULL,
  attempts    INT NOT NULL DEFAULT 0,
  created_at  DATETIME(6) NOT NULL,
  user_id     BIGINT NOT NULL,
  PRIMARY KEY (id),
  KEY idx_evt_user (user_id),
  CONSTRAINT fk_evt_user FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ── 3. notes.status — add the new publication states ────────
ALTER TABLE notes
  MODIFY COLUMN status ENUM('PENDING_REVIEW','REJECTED','ACTIVE','INACTIVE','DELETED') NOT NULL;

-- ── 4. Sanity check ─────────────────────────────────────────
SELECT 'users.email_verified' AS item,
       (SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='email_verified') AS present;
SHOW COLUMNS FROM notes LIKE 'status';

-- ============================================================
--  TopNotes — PRODUCTION (Render PostgreSQL) migration
--  Note publish gate: add notes.approved
--
--  Adds a boolean `approved` flag. A note may only be set ACTIVE (live) by the
--  seller's "publish" action when approved = true; otherwise publishing routes it
--  to PENDING_REVIEW. The flag is set true only by admin approval and reset to
--  false whenever the content (PDF) changes or a clone is made. This closes the
--  loophole where a clone / hidden / edited note could go live without review.
--
--  Run ONCE on prod BEFORE deploying the publish-gate build.
--  Fresh databases don't need this — Hibernate creates the column.
--
--  Also adds notes.rejection_reason — the admin's reason shown to the seller
--  when a note is REJECTED.
--
--  (On local MySQL the equivalent is:
--     ALTER TABLE notes ADD COLUMN approved BIT(1) NOT NULL DEFAULT 0;
--     UPDATE notes SET approved = 1 WHERE status = 'ACTIVE';
--     ALTER TABLE notes ADD COLUMN rejection_reason VARCHAR(1000) NULL; )
-- ============================================================

BEGIN;

ALTER TABLE notes ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR(1000);

-- Backfill: notes that are currently live were admin-approved, so preserve the
-- seller's ability to hide/republish them without a fresh review.
-- NOTE: review any ACTIVE note you suspect bypassed review before running this,
-- since it will be treated as approved.
UPDATE notes SET approved = TRUE WHERE status = 'ACTIVE';

COMMIT;

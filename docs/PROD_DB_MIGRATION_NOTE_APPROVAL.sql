-- ============================================================
--  TopNotes — PRODUCTION (Render PostgreSQL) migration
--  Note content-approval: allow new note statuses
--
--  Hibernate maps NoteStatus (@Enumerated STRING) to a CHECK-constrained
--  column. The original constraint only allowed ACTIVE/INACTIVE/DELETED, so
--  inserting PENDING_REVIEW/REJECTED fails until the constraint is widened.
--  (On local MySQL the equivalent fix was:
--     ALTER TABLE notes MODIFY COLUMN status
--       ENUM('PENDING_REVIEW','REJECTED','ACTIVE','INACTIVE','DELETED') NOT NULL; )
--
--  Run ONCE on prod BEFORE deploying the note-approval build.
--  Fresh databases don't need this — Hibernate creates the column with all
--  five values from the current enum.
-- ============================================================

BEGIN;

ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_status_check;
ALTER TABLE notes ADD CONSTRAINT notes_status_check
  CHECK (status IN ('PENDING_REVIEW', 'REJECTED', 'ACTIVE', 'INACTIVE', 'DELETED'));

COMMIT;

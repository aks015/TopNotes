-- ═══════════════════════════════════════════════════════════════════
-- TopNotes — Configurable Test System Schema
-- Run this ONCE on your MySQL database (or let JPA ddl-auto handle it)
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. test_config ───────────────────────────────────────────────
--    Singleton table — only one row is ever created.
CREATE TABLE IF NOT EXISTS test_config (
    id                   BIGINT       NOT NULL AUTO_INCREMENT,
    pass_score_percent   INT          NOT NULL DEFAULT 70,
    time_limit_minutes   INT          NOT NULL DEFAULT 30,
    max_attempts         INT          NOT NULL DEFAULT 0,
    questions_per_test   INT          NOT NULL DEFAULT 10,
    shuffle_questions    BOOLEAN      NOT NULL DEFAULT TRUE,
    shuffle_options      BOOLEAN      NOT NULL DEFAULT FALSE,
    is_active            BOOLEAN      NOT NULL DEFAULT TRUE,
    updated_at           DATETIME(6),
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 2. test_questions ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS test_questions (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    question_text TEXT         NOT NULL,
    subject       VARCHAR(100),
    display_order INT          NOT NULL DEFAULT 0,
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    DATETIME(6)  NOT NULL,
    updated_at    DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    INDEX idx_question_active  (is_active),
    INDEX idx_question_order   (display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 3. test_options ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS test_options (
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    question_id  BIGINT       NOT NULL,
    option_key   VARCHAR(5)   NOT NULL,
    option_text  TEXT         NOT NULL,
    is_correct   BOOLEAN      NOT NULL DEFAULT FALSE,
    PRIMARY KEY (id),
    INDEX idx_option_question (question_id),
    CONSTRAINT fk_option_question
        FOREIGN KEY (question_id) REFERENCES test_questions(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ═══════════════════════════════════════════════════════════════════
-- SEED DATA — Default test config + 10 starter questions
-- Admin can edit/replace these from the UI at any time.
-- ═══════════════════════════════════════════════════════════════════

INSERT IGNORE INTO test_config
    (pass_score_percent, time_limit_minutes, max_attempts, questions_per_test,
     shuffle_questions, shuffle_options, is_active, updated_at)
VALUES
    (70, 30, 0, 10, TRUE, FALSE, TRUE, NOW());


-- Question 1
INSERT INTO test_questions (question_text, subject, display_order, is_active, created_at, updated_at)
VALUES ('What is the derivative of x^2?', 'Mathematics', 1, TRUE, NOW(), NOW());

SET @q1 = LAST_INSERT_ID();
INSERT INTO test_options (question_id, option_key, option_text, is_correct) VALUES
    (@q1, 'A', '2x',  TRUE),
    (@q1, 'B', 'x^2',  FALSE),
    (@q1, 'C', 'x',   FALSE),
    (@q1, 'D', '2',   FALSE);

-- Question 2
INSERT INTO test_questions (question_text, subject, display_order, is_active, created_at, updated_at)
VALUES ('Solve: 2x + 5 = 15', 'Mathematics', 2, TRUE, NOW(), NOW());

SET @q2 = LAST_INSERT_ID();
INSERT INTO test_options (question_id, option_key, option_text, is_correct) VALUES
    (@q2, 'A', 'x = 3',  FALSE),
    (@q2, 'B', 'x = 5',  TRUE),
    (@q2, 'C', 'x = 10', FALSE),
    (@q2, 'D', 'x = 7',  FALSE);

-- Question 3
INSERT INTO test_questions (question_text, subject, display_order, is_active, created_at, updated_at)
VALUES ('Newton''s First Law is also known as?', 'Physics', 3, TRUE, NOW(), NOW());

SET @q3 = LAST_INSERT_ID();
INSERT INTO test_options (question_id, option_key, option_text, is_correct) VALUES
    (@q3, 'A', 'Law of Force (F = ma)',   FALSE),
    (@q3, 'B', 'Law of Inertia',          TRUE),
    (@q3, 'C', 'Law of Gravitation',      FALSE),
    (@q3, 'D', 'Law of Action-Reaction',  FALSE);

-- Question 4
INSERT INTO test_questions (question_text, subject, display_order, is_active, created_at, updated_at)
VALUES ('What is the chemical formula of water?', 'Chemistry', 4, TRUE, NOW(), NOW());

SET @q4 = LAST_INSERT_ID();
INSERT INTO test_options (question_id, option_key, option_text, is_correct) VALUES
    (@q4, 'A', 'H2O2', FALSE),
    (@q4, 'B', 'H2O',  TRUE),
    (@q4, 'C', 'HO',   FALSE),
    (@q4, 'D', 'H3O',  FALSE);

-- Question 5
INSERT INTO test_questions (question_text, subject, display_order, is_active, created_at, updated_at)
VALUES ('Approximate value of pi?', 'Mathematics', 5, TRUE, NOW(), NOW());

SET @q5 = LAST_INSERT_ID();
INSERT INTO test_options (question_id, option_key, option_text, is_correct) VALUES
    (@q5, 'A', '3.14', TRUE),
    (@q5, 'B', '2.71', FALSE),
    (@q5, 'C', '1.41', FALSE),
    (@q5, 'D', '1.73', FALSE);

-- Question 6
INSERT INTO test_questions (question_text, subject, display_order, is_active, created_at, updated_at)
VALUES ('Speed of light in vacuum?', 'Physics', 6, TRUE, NOW(), NOW());

SET @q6 = LAST_INSERT_ID();
INSERT INTO test_options (question_id, option_key, option_text, is_correct) VALUES
    (@q6, 'A', '3 x 10^8 m/s',  TRUE),
    (@q6, 'B', '3 x 10^6 m/s',  FALSE),
    (@q6, 'C', '3 x 10^10 m/s', FALSE),
    (@q6, 'D', '3 x 10^4 m/s',  FALSE);

-- Question 7
INSERT INTO test_questions (question_text, subject, display_order, is_active, created_at, updated_at)
VALUES ('Who wrote "The Discovery of India"?', 'History', 7, TRUE, NOW(), NOW());

SET @q7 = LAST_INSERT_ID();
INSERT INTO test_options (question_id, option_key, option_text, is_correct) VALUES
    (@q7, 'A', 'Mahatma Gandhi',      FALSE),
    (@q7, 'B', 'Jawaharlal Nehru',    TRUE),
    (@q7, 'C', 'Subhas Chandra Bose', FALSE),
    (@q7, 'D', 'Sardar Patel',        FALSE);

-- Question 8
INSERT INTO test_questions (question_text, subject, display_order, is_active, created_at, updated_at)
VALUES ('Photosynthesis primarily produces?', 'Biology', 8, TRUE, NOW(), NOW());

SET @q8 = LAST_INSERT_ID();
INSERT INTO test_options (question_id, option_key, option_text, is_correct) VALUES
    (@q8, 'A', 'CO2 and H2O',  FALSE),
    (@q8, 'B', 'O2 and Glucose', TRUE),
    (@q8, 'C', 'N2 and O2',    FALSE),
    (@q8, 'D', 'H2 and CO2',   FALSE);

-- Question 9
INSERT INTO test_questions (question_text, subject, display_order, is_active, created_at, updated_at)
VALUES ('According to Ohm''s Law, V equals?', 'Physics', 9, TRUE, NOW(), NOW());

SET @q9 = LAST_INSERT_ID();
INSERT INTO test_options (question_id, option_key, option_text, is_correct) VALUES
    (@q9, 'A', 'I / R', FALSE),
    (@q9, 'B', 'I x R', TRUE),
    (@q9, 'C', 'I + R', FALSE),
    (@q9, 'D', 'I - R', FALSE);

-- Question 10
INSERT INTO test_questions (question_text, subject, display_order, is_active, created_at, updated_at)
VALUES ('What is the capital of India?', 'General Knowledge', 10, TRUE, NOW(), NOW());

SET @q10 = LAST_INSERT_ID();
INSERT INTO test_options (question_id, option_key, option_text, is_correct) VALUES
    (@q10, 'A', 'Mumbai',    FALSE),
    (@q10, 'B', 'New Delhi', TRUE),
    (@q10, 'C', 'Kolkata',   FALSE),
    (@q10, 'D', 'Chennai',   FALSE);

-- ═══════════════════════════════════════════════════════════════════
-- DONE — 10 default questions loaded.
-- Admin can add more, edit these, delete, reorder, or disable
-- from the Admin → Test Management page without touching code.
-- ═══════════════════════════════════════════════════════════════════

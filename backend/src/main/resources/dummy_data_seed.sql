-- ═══════════════════════════════════════════════════════
-- TOPNOTES DUMMY DATA — Run AFTER starting the backend
-- (JPA creates tables automatically on first run)
-- ═══════════════════════════════════════════════════════

-- ─── 1. PLATFORM CONFIG ───────────────────────────────
INSERT IGNORE INTO platform_config (config_key, config_value, description, updated_at) VALUES
('platform-commission-percent', '35', 'Platform revenue cut in %',       NOW()),
('seller-commission-percent',   '65', 'Seller revenue share in %',       NOW()),
('test-pass-score-percent',     '70', 'Minimum test score to pass',      NOW()),
('currency',                    'INR','Display currency',                 NOW());

-- ─── 2. USERS ─────────────────────────────────────────
-- Password for ALL users below = "Test@1234"
SET @pwd = '$2a$12$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

-- Admin (password = "Admin@123")
INSERT IGNORE INTO users (email, password, full_name, role, status, is_verified, test_passed, marksheet_approved, created_at, updated_at)
VALUES ('admin@topnotes.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4QA1iBFW7G', 'Admin', 'ADMIN', 'ACTIVE', 1, 1, 1, NOW(), NOW());

-- ── Verified Sellers (can upload notes) ──
INSERT IGNORE INTO users (email, password, full_name, phone, role, status, is_verified, test_passed, test_score, marksheet_approved, class_level, institution, bio, created_at, updated_at) VALUES
('aarav.patel@email.com',    @pwd, 'Aarav Patel',    '9876543210', 'SELLER', 'ACTIVE', 1, 1, 90, 1, 'Class 12', 'IIT Bombay',  'JEE 2023 AIR 47. Physics and Maths topper. I believe in concept clarity over rote learning.', NOW(), NOW()),
('priya.sharma@email.com',   @pwd, 'Priya Sharma',   '9876543211', 'SELLER', 'ACTIVE', 1, 1, 85, 1, 'Class 12', 'AIIMS Delhi', 'NEET 2023 AIR 89. Biology and Chemistry expert. CBSE 98.4% scorer.', NOW(), NOW()),
('rahul.gupta@email.com',    @pwd, 'Rahul Gupta',    '9876543212', 'SELLER', 'ACTIVE', 1, 1, 80, 1, 'Class 12', 'IIT Delhi',   'JEE Advanced 2023 AIR 212. Maths enthusiast. 3 years teaching experience.', NOW(), NOW()),
('meera.iyer@email.com',     @pwd, 'Meera Iyer',     '9876543213', 'SELLER', 'ACTIVE', 1, 1, 95, 1, 'Class 11', 'NIT Trichy',  'Class 12 CBSE 97.8%. Passionate about Chemistry and making complex topics simple.', NOW(), NOW()),
('vikram.nair@email.com',    @pwd, 'Vikram Nair',    '9876543214', 'SELLER', 'ACTIVE', 1, 1, 88, 1, 'Dropper',  'IIT Madras',  'IIT Madras 2022 alumnus. Specializes in Physics for JEE. AIR 156.', NOW(), NOW()),

-- ── Unverified Seller (for testing verification flow) ──
('karan.mehta@email.com',    @pwd, 'Karan Mehta',    '9876543215', 'SELLER', 'ACTIVE', 0, 0, NULL, 0, 'Class 12', 'DPS Delhi',   'Aspiring seller — verification pending.', NOW(), NOW()),

-- ── Seller: Test passed but marksheet not uploaded ──
('sneha.patel@email.com',    @pwd, 'Sneha Patel',    '9876543216', 'SELLER', 'ACTIVE', 0, 1, 75,  0, 'Class 12', 'Kendriya Vidyalaya', 'Test passed, waiting to upload marksheet.', NOW(), NOW()),

-- ── Seller: Marksheet uploaded, awaiting admin approval ──
('arjun.singh@email.com',    @pwd, 'Arjun Singh',    '9876543217', 'SELLER', 'ACTIVE', 0, 1, 82,  0, 'Dropper',  'Resonance Kota', 'Marksheet uploaded, admin review pending.', NOW(), NOW()),

-- ── Buyers ──
('rohan.kumar@email.com',    @pwd, 'Rohan Kumar',    '9876543220', 'BUYER',  'ACTIVE', 0, 0, NULL, 0, NULL, NULL, NULL, NOW(), NOW()),
('anita.roy@email.com',      @pwd, 'Anita Roy',      '9876543221', 'BUYER',  'ACTIVE', 0, 0, NULL, 0, NULL, NULL, NULL, NOW(), NOW()),
('dev.krishna@email.com',    @pwd, 'Dev Krishna',    '9876543222', 'BUYER',  'ACTIVE', 0, 0, NULL, 0, NULL, NULL, NULL, NOW(), NOW()),
('pooja.verma@email.com',    @pwd, 'Pooja Verma',    '9876543223', 'BUYER',  'ACTIVE', 0, 0, NULL, 0, NULL, NULL, NULL, NOW(), NOW()),
('amit.joshi@email.com',     @pwd, 'Amit Joshi',     '9876543224', 'BUYER',  'ACTIVE', 0, 0, NULL, 0, NULL, NULL, NULL, NOW(), NOW()),
('nisha.mishra@email.com',   @pwd, 'Nisha Mishra',   '9876543225', 'BUYER',  'ACTIVE', 0, 0, NULL, 0, NULL, NULL, NULL, NOW(), NOW()),
('tanvir.ahmed@email.com',   @pwd, 'Tanvir Ahmed',   '9876543226', 'BUYER',  'SUSPENDED', 0, 0, NULL, 0, NULL, NULL, NULL, NOW(), NOW());

-- ─── 3. NOTES ─────────────────────────────────────────
SET @s1 = (SELECT id FROM users WHERE email = 'aarav.patel@email.com');
SET @s2 = (SELECT id FROM users WHERE email = 'priya.sharma@email.com');
SET @s3 = (SELECT id FROM users WHERE email = 'rahul.gupta@email.com');
SET @s4 = (SELECT id FROM users WHERE email = 'meera.iyer@email.com');
SET @s5 = (SELECT id FROM users WHERE email = 'vikram.nair@email.com');

INSERT INTO notes (title, description, class_level, subject, exam_type, price, pdf_url, preview_url, total_pages, status, purchase_count, average_rating, review_count, seller_id, created_at, updated_at) VALUES

('Electrostatics & Capacitors — Complete JEE Notes',
 'Comprehensive handwritten notes covering Coulomb Law, Electric Field, Electric Potential, Capacitors with dielectric, energy stored in capacitor. Includes 40+ solved numericals, all important formulas with derivations. Perfect for JEE Advanced preparation.',
 'Class 12', 'Physics', 'JEE_ADVANCED', 249.00,
 '/pdfs/dummy1.pdf', '/pdfs/dummy1.pdf', 34, 'ACTIVE', 127, 4.90, 42, @s1, NOW(), NOW()),

('Magnetism & Electromagnetic Induction',
 'Detailed notes on Biot-Savart law, Ampere law, Faraday law, Lenz law, self and mutual inductance. All derivations step by step with memory tricks. 35+ solved problems from previous JEE papers.',
 'Class 12', 'Physics', 'JEE_MAIN', 199.00,
 '/pdfs/dummy2.pdf', '/pdfs/dummy2.pdf', 28, 'ACTIVE', 89, 4.70, 31, @s1, NOW(), NOW()),

('Modern Physics — Photoelectric Effect to Nuclear Physics',
 'Complete modern physics from photoelectric effect, de Broglie wavelength, Bohr model, X-rays, nuclear fission and fusion. Includes important graphs and derivations.',
 'Class 12', 'Physics', 'BOARD', 179.00,
 '/pdfs/dummy3.pdf', '/pdfs/dummy3.pdf', 22, 'ACTIVE', 64, 4.80, 19, @s1, NOW(), NOW()),

('Human Physiology — Complete NEET Notes',
 'All body systems covered: Digestive, Respiratory, Circulatory, Excretory, Nervous, Endocrine. Fully labeled diagrams drawn by hand, important hormones table, disease comparison charts. Highest-yield topics for NEET highlighted.',
 'Class 12', 'Biology', 'NEET', 229.00,
 '/pdfs/dummy4.pdf', '/pdfs/dummy4.pdf', 46, 'ACTIVE', 198, 5.00, 67, @s2, NOW(), NOW()),

('Plant Kingdom & Animal Kingdom — Classification Notes',
 'Complete classification with characteristics, examples and differences. Includes bryophytes, pteridophytes, gymnosperms, angiosperms, all animal phyla with diagrams. NCERT-aligned with extra NEET tips.',
 'Class 11', 'Biology', 'NEET', 189.00,
 '/pdfs/dummy5.pdf', '/pdfs/dummy5.pdf', 73, 'ACTIVE', 142, 4.80, 48, @s2, NOW(), NOW()),

('Organic Chemistry — Reactions & Mechanisms Handbook',
 'All name reactions with mechanism: Aldol, Cannizzaro, Williamson, Grignard, Clemmensen, etc. Color-coded by reaction type, reagent summary tables. Best for last-minute NEET/JEE revision.',
 'Class 12', 'Chemistry', 'NEET', 219.00,
 '/pdfs/dummy6.pdf', '/pdfs/dummy6.pdf', 91, 'ACTIVE', 213, 4.90, 72, @s2, NOW(), NOW()),

('Integration Techniques — Complete JEE Maths',
 'All integration methods: by parts, substitution, partial fractions, trigonometric, reduction formulae. 100+ solved examples from JEE Mains and Advanced. Includes standard results you must memorize.',
 'Class 12', 'Mathematics', 'JEE_MAIN', 199.00,
 '/pdfs/dummy7.pdf', '/pdfs/dummy7.pdf', 39, 'ACTIVE', 108, 4.60, 35, @s3, NOW(), NOW()),

('3D Geometry & Vectors — JEE Notes',
 'Direction cosines, equation of line and plane in 3D, distance formula, angle between planes, vectors dot and cross product applications. All JEE previous year questions solved.',
 'Class 12', 'Mathematics', 'JEE_ADVANCED', 219.00,
 '/pdfs/dummy8.pdf', '/pdfs/dummy8.pdf', 31, 'ACTIVE', 56, 4.70, 22, @s3, NOW(), NOW()),

('Trigonometry — Formulae & Problem-Solving Tricks',
 'All trigonometric identities, inverse trig, general solutions, heights and distances. Includes quick tricks for multiple choice questions and important graph shapes.',
 'Class 11', 'Mathematics', 'BOARD', 159.00,
 '/pdfs/dummy9.pdf', '/pdfs/dummy9.pdf', 24, 'ACTIVE', 47, 4.50, 18, @s3, NOW(), NOW()),

('Chemical Bonding & Molecular Structure',
 'VSEPR theory, hybridization sp/sp2/sp3, MO theory with bond order, dipole moment, hydrogen bonding, van der Waals forces. Beautiful handmade diagrams with 3D structures.',
 'Class 11', 'Chemistry', 'NEET', 169.00,
 '/pdfs/dummy10.pdf', '/pdfs/dummy10.pdf', 28, 'ACTIVE', 81, 4.80, 29, @s4, NOW(), NOW()),

('Electrochemistry — Complete Notes',
 'Galvanic cells, electrode potential, Nernst equation, electrolysis, Faraday laws, corrosion, fuel cells. All derivations with worked examples.',
 'Class 12', 'Chemistry', 'JEE_MAIN', 189.00,
 '/pdfs/dummy11.pdf', '/pdfs/dummy11.pdf', 33, 'ACTIVE', 62, 4.70, 24, @s4, NOW(), NOW()),

('Mechanics — JEE Complete Notes (Kinematics to Rotational Motion)',
 'From kinematics basics to rotational dynamics. Newton laws applications, circular motion, friction, work energy theorem, momentum, collisions, rotational motion with moment of inertia. 120+ solved problems.',
 'Class 11', 'Physics', 'JEE_ADVANCED', 279.00,
 '/pdfs/dummy12.pdf', '/pdfs/dummy12.pdf', 52, 'ACTIVE', 167, 4.80, 58, @s5, NOW(), NOW()),

('Waves & Thermodynamics',
 'SHM, waves on string, sound waves, Doppler effect, thermodynamics laws, Carnot engine, kinetic theory. All graphs explained with physical meaning.',
 'Class 11', 'Physics', 'JEE_MAIN', 199.00,
 '/pdfs/dummy13.pdf', '/pdfs/dummy13.pdf', 38, 'ACTIVE', 94, 4.60, 33, @s5, NOW(), NOW()),

('Old Chemistry Notes — Deleted',
 'These notes have been removed.', 'Class 12', 'Chemistry', 'BOARD', 99.00,
 '/pdfs/dummy14.pdf', '/pdfs/dummy14.pdf', 10, 'DELETED', 3, 0.00, 0, @s4, NOW(), NOW());

-- ─── 4. PURCHASES ─────────────────────────────────────
SET @b1 = (SELECT id FROM users WHERE email = 'rohan.kumar@email.com');
SET @b2 = (SELECT id FROM users WHERE email = 'anita.roy@email.com');
SET @b3 = (SELECT id FROM users WHERE email = 'dev.krishna@email.com');
SET @b4 = (SELECT id FROM users WHERE email = 'pooja.verma@email.com');
SET @b5 = (SELECT id FROM users WHERE email = 'amit.joshi@email.com');

SET @n1  = (SELECT id FROM notes WHERE title LIKE 'Electrostatics%');
SET @n4  = (SELECT id FROM notes WHERE title LIKE 'Human Physiology%');
SET @n6  = (SELECT id FROM notes WHERE title LIKE 'Organic Chemistry%');
SET @n7  = (SELECT id FROM notes WHERE title LIKE 'Integration%');
SET @n12 = (SELECT id FROM notes WHERE title LIKE 'Mechanics%');

INSERT INTO purchases (buyer_id, note_id, seller_id, amount, platform_share, seller_share, transaction_id, invoice_number, status, purchased_at) VALUES
(@b1, @n1,  @s1, 249.00, 87.15, 161.85, 'TXN-A1B2C3D4E5F6', 'INV-20240115-A1B2C3', 'COMPLETED', '2024-01-15 10:30:00'),
(@b1, @n4,  @s2, 229.00, 80.15, 148.85, 'TXN-B2C3D4E5F6G7', 'INV-20240116-B2C3D4', 'COMPLETED', '2024-01-16 14:22:00'),
(@b1, @n12, @s5, 279.00, 97.65, 181.35, 'TXN-C3D4E5F6G7H8', 'INV-20240120-C3D4E5', 'COMPLETED', '2024-01-20 09:15:00'),
(@b2, @n6,  @s2, 219.00, 76.65, 142.35, 'TXN-D4E5F6G7H8I9', 'INV-20240118-D4E5F6', 'COMPLETED', '2024-01-18 16:45:00'),
(@b2, @n12, @s5, 279.00, 97.65, 181.35, 'TXN-E5F6G7H8I9J0', 'INV-20240122-E5F6G7', 'COMPLETED', '2024-01-22 11:30:00'),
(@b3, @n7,  @s3, 199.00, 69.65, 129.35, 'TXN-F6G7H8I9J0K1', 'INV-20240117-F6G7H8', 'COMPLETED', '2024-01-17 13:10:00'),
(@b3, @n1,  @s1, 249.00, 87.15, 161.85, 'TXN-G7H8I9J0K1L2', 'INV-20240119-G7H8I9', 'COMPLETED', '2024-01-19 15:20:00'),
(@b4, @n4,  @s2, 229.00, 80.15, 148.85, 'TXN-H8I9J0K1L2M3', 'INV-20240121-H8I9J0', 'COMPLETED', '2024-01-21 08:45:00'),
(@b5, @n6,  @s2, 219.00, 76.65, 142.35, 'TXN-I9J0K1L2M3N4', 'INV-20240123-I9J0K1', 'COMPLETED', '2024-01-23 17:30:00');

-- ─── 5. EARNINGS ──────────────────────────────────────
INSERT INTO earnings (seller_id, purchase_id, amount, is_paid, earned_at)
SELECT seller_id, id, seller_share, 0, purchased_at FROM purchases;

-- ─── 6. REVIEWS ───────────────────────────────────────
-- No dummy reviews. Reviews are created only by real buyers through the app.
-- Notes therefore start with no rating; review_count/average_rating stay 0
-- until genuine reviews arrive (UI shows "New" until then).
UPDATE notes SET average_rating = 0, review_count = 0;

-- Keep the denormalised sales counter in sync with the real purchase rows above,
-- so "Notes sold" on the dashboard and Manage-notes match actual purchases.
UPDATE notes n SET purchase_count =
    (SELECT COUNT(*) FROM purchases p WHERE p.note_id = n.id AND p.status = 'COMPLETED');

-- ─── 7. NOTIFICATIONS ─────────────────────────────────
SET @seller1 = (SELECT id FROM users WHERE email = 'aarav.patel@email.com');
SET @seller2 = (SELECT id FROM users WHERE email = 'priya.sharma@email.com');
SET @buyer1  = (SELECT id FROM users WHERE email = 'rohan.kumar@email.com');

INSERT INTO notifications (user_id, title, message, type, is_read, created_at) VALUES
(@seller1, 'New Sale!', 'Your note "Electrostatics & Capacitors" was purchased. You earned 161.85', 'SALE', 0, NOW()),
(@seller1, 'New Sale!', 'Your note "Magnetism & Electromagnetic Induction" was purchased. You earned 129.35', 'SALE', 1, NOW()),
(@seller2, 'New Sale!', 'Your note "Human Physiology" was purchased. You earned 148.85', 'SALE', 0, NOW()),
(@seller2, 'New Sale!', 'Your note "Organic Chemistry Reactions" was purchased. You earned 142.35', 'SALE', 0, NOW()),
(@buyer1,  'Purchase Confirmed', 'Your purchase of "Electrostatics & Capacitors" is confirmed. Invoice: INV-20240115-A1B2C3', 'PAYMENT', 1, NOW()),
(@buyer1,  'Purchase Confirmed', 'Your purchase of "Human Physiology" is confirmed. Invoice: INV-20240116-B2C3D4', 'PAYMENT', 1, NOW()),
(@seller1, 'Account Approved!', 'Your seller account has been verified and approved. Start uploading notes!', 'VERIFICATION', 1, NOW()),
(@seller2, 'New Review', 'Rohan Kumar gave your note "Human Physiology" 5 stars!', 'REVIEW', 0, NOW());

-- ─── 8. VERIFICATION TEST ATTEMPTS ───────────────────
SET @karan = (SELECT id FROM users WHERE email = 'karan.mehta@email.com');
SET @sneha = (SELECT id FROM users WHERE email = 'sneha.patel@email.com');
SET @arjun = (SELECT id FROM users WHERE email = 'arjun.singh@email.com');

INSERT INTO verification_tests (seller_id, score, total_questions, correct_answers, passed, answers_json, attempted_at) VALUES
(@karan, 50, 10, 5, 0, '{1:A,2:A,3:B,4:B,5:A,6:C,7:A,8:B,9:A,10:C}', NOW());

INSERT INTO verification_tests (seller_id, score, total_questions, correct_answers, passed, answers_json, attempted_at) VALUES
(@sneha, 75, 10, 7, 1, '{1:A,2:B,3:B,4:B,5:A,6:A,7:B,8:B,9:B,10:B}', NOW());

UPDATE users SET test_passed = 1, test_score = 75 WHERE id = @sneha;

INSERT INTO verification_tests (seller_id, score, total_questions, correct_answers, passed, answers_json, attempted_at) VALUES
(@arjun, 82, 10, 8, 1, '{1:A,2:B,3:B,4:B,5:A,6:A,7:B,8:B,9:B,10:B}', NOW());

UPDATE users SET test_passed = 1, test_score = 82, marksheet_url = '/marksheets/dummy_marksheet.jpg'
WHERE id = @arjun;

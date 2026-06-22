# Dev setup & DB migration — `feat/marketplace-enhancements`

This branch adds email verification, consent, one-domain seller qualification, and
**admin note approval**. Most schema changes apply **automatically** via Hibernate
(`spring.jpa.hibernate.ddl-auto=update`) on the first backend start. Only **one**
manual DB step is strictly required (Step 4).

> Local stack assumed: MySQL in Docker (`topnotes-mysql`, user/pass `root`/`root`,
> db `topnotes_db`). If you run MySQL differently, use your own client/credentials —
> only the SQL matters.

---

## 1. Get the code & build prereqs
```bash
git fetch origin
git checkout feat/marketplace-enhancements
git pull
```
- **Backend needs JDK 21** (project targets Java 21). `java -version` should report 21.
- Frontend: `cd frontend && npm install` (a new dep, `ngx-image-cropper`, was added).

## 2. Backend env — email OTP (optional but recommended)
In `backend/.env` add:
```
MAIL_USERNAME=<a-gmail-address>
MAIL_PASSWORD=<16-char Gmail App Password, NO spaces>
```
Leave `MAIL_PASSWORD` blank to **log** the OTP in the backend console instead of
emailing (fine for local testing).

## 3. Start MySQL, then the backend (auto-migrates schema)
Start the DB first, then the backend. On boot Hibernate will **create/alter automatically**:
- New tables: `email_verification_tokens`, `consent_records`, `agreement_documents`
- New column: `users.email_verified`
- `AgreementSeeder` seeds the Seller Agreement + Originality Declaration

```bash
# Aman's local docker flow (adjust to yours):
docker build -t topnotes-backend:latest backend
docker rm -f topnotes-backend
docker run -d --name topnotes-backend --network topnotes-net -p 8080:8080 --env-file backend/.env topnotes-backend:latest
# health check
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/api/health   # → 200
```

## 4. ⚠️ REQUIRED — run the explicit MySQL migration
Don't rely on Hibernate auto-DDL — it can't add values to an existing `ENUM`
(`notes.status`) and on some setups it skips adding `users.email_verified`, which
then throws **"Unknown column 'email_verified'"** on *every* user query (login, etc.).

Run the one idempotent script — it adds `users.email_verified`, creates the new
tables if missing, and widens `notes.status`:
```bash
docker exec -i topnotes-mysql mysql -uroot -proot topnotes_db < docs/DEV_DB_MIGRATION_MYSQL.sql
```
It prints a sanity check at the end (`email_verified present = 1`, and the 5-value
`status` enum). Safe to run multiple times.

> Restart the backend after running it if it was already up.

## 5. (Optional) Grandfather existing users as email-verified
New `users.email_verified` defaults to `0`, so existing accounts show "unverified".
To avoid that locally:
```bash
docker exec topnotes-mysql mysql -uroot -proot topnotes_db -e "UPDATE users SET email_verified = 1;"
```

## 6. (Optional) Admin account
Use your own admin, or align with shared local admin:
```bash
docker exec topnotes-mysql mysql -uroot -proot topnotes_db -e \
"UPDATE users SET email_verified = 1 WHERE role = 'ADMIN';"
```

## 7. (Optional) Purge dummy/seed data for clean real-data testing
Only if you want a clean DB (this is what we did locally). **Back up first:**
```bash
docker exec topnotes-mysql sh -c 'exec mysqldump -uroot -proot --databases topnotes_db' > backend/db-backup.sql
```
Then delete dummy content + users (keep your real accounts; adjust the email filter):
```sql
-- run inside: docker exec -i topnotes-mysql mysql -uroot -proot topnotes_db
START TRANSACTION;
DELETE FROM earnings;
DELETE FROM reviews;
DELETE FROM purchases;
DELETE FROM notes;
-- dummy users = the seed accounts (@email.com) + test accounts (@test.*)
DELETE FROM payout_requests       WHERE seller_id IN (SELECT id FROM (SELECT id FROM users WHERE email LIKE '%@email.com' OR email LIKE '%@test.%') t);
DELETE FROM verification_tests    WHERE seller_id IN (SELECT id FROM (SELECT id FROM users WHERE email LIKE '%@email.com' OR email LIKE '%@test.%') t);
DELETE FROM seller_qualifications WHERE seller_id IN (SELECT id FROM (SELECT id FROM users WHERE email LIKE '%@email.com' OR email LIKE '%@test.%') t);
DELETE FROM notifications         WHERE user_id  IN (SELECT id FROM (SELECT id FROM users WHERE email LIKE '%@email.com' OR email LIKE '%@test.%') t);
DELETE FROM users                 WHERE email LIKE '%@email.com' OR email LIKE '%@test.%';
COMMIT;
```
> Note: deleting all `notes` also clears purchases/reviews tied to them — intended for
> a clean slate. If you have real notes to keep, scope these deletes instead.

## 8. Verify end-to-end
- Sign up (real email or `you+test@gmail.com`) → enter OTP (inbox or backend log)
- Become a seller → accept Seller Agreement → pass test → upload marksheet (+institution)
- Admin → **Verifications** → approve → seller becomes verified in one domain
- Seller uploads a note → status **In review** → Admin → **Note approvals** → Approve → note goes live

---

### Production
Separate, idempotent PostgreSQL scripts are in `docs/PROD_DB_MIGRATION_*.sql`
(`AUTH`, `CONSENT`, `NOTE_APPROVAL`). Run them once before deploying.

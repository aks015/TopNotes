package com.topnotes.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * One-time backfill: maps legacy notes that only have an {@code exam_type} enum
 * onto the new dynamic {@code category}/{@code exam} columns. Idempotent — only
 * touches rows whose category is still NULL, so it's safe on every boot.
 */
@Component
@Order(21)
@Slf4j
public class NoteTaxonomyBackfill implements CommandLineRunner {

    private final JdbcTemplate jdbc;

    public NoteTaxonomyBackfill(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void run(String... args) {
        int total = 0;
        total += map("JEE_MAIN",     "Engineering",     "JEE Main");
        total += map("JEE_ADVANCED", "Engineering",     "JEE Advanced");
        total += map("GATE",         "Engineering",     "GATE");
        total += map("NEET",         "Medical",         "NEET UG");
        total += map("UPSC",         "Civil Services",  "UPSC CSE");
        total += map("CAT",          "Management",      "CAT");
        total += map("BOARD",        "School (Boards)", "CBSE Class 12");
        // Anything left (OTHER / null enum) → a generic bucket so cards still render.
        try {
            total += jdbc.update(
                    "UPDATE notes SET category = 'Other', exam = COALESCE(exam, 'Other') " +
                    "WHERE category IS NULL OR category = ''");
        } catch (Exception e) {
            log.warn("Note taxonomy backfill (fallback) skipped: {}", e.getMessage());
        }
        if (total > 0) log.info("Backfilled taxonomy on {} legacy note rows.", total);
    }

    private int map(String examType, String category, String exam) {
        try {
            return jdbc.update(
                    "UPDATE notes SET category = ?, exam = ? WHERE exam_type = ? AND (category IS NULL OR category = '')",
                    category, exam, examType);
        } catch (Exception e) {
            log.warn("Note taxonomy backfill for {} skipped: {}", examType, e.getMessage());
            return 0;
        }
    }
}

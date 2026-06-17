package com.topnotes.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Global configuration for the seller verification test.
 * Only ONE row is ever created (singleton pattern via findFirst()).
 *
 * Admin can change:
 *  - passScorePercent   → Minimum % to pass (default 70)
 *  - timeLimitMinutes   → Seconds per test session (0 = no limit)
 *  - maxAttempts        → How many times seller can retake (0 = unlimited)
 *  - questionsPerTest   → How many random questions to pick from the bank
 *  - shuffleQuestions   → Randomise question order per attempt
 *  - shuffleOptions     → Randomise option order per attempt
 *  - isActive           → Completely enable/disable the test requirement
 */
@Entity
@Table(name = "test_config", uniqueConstraints = @UniqueConstraint(columnNames = "category_id"))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class TestConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Exam category this config applies to. NULL = the global "Default" config,
     * used as a fallback for any category without its own row. Per-category
     * qualification: each category can have its own test settings.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private ExamCategory category;

    /** Minimum percentage score to pass (0–100). Default: 70 */
    @Column(nullable = false)
    @Builder.Default
    private Integer passScorePercent = 70;

    /** Time limit in minutes (0 = no time limit). Default: 30 */
    @Column(nullable = false)
    @Builder.Default
    private Integer timeLimitMinutes = 30;

    /** Max re-attempts allowed (0 = unlimited). Default: 0 */
    @Column(nullable = false)
    @Builder.Default
    private Integer maxAttempts = 0;

    /**
     * How many questions to serve per attempt.
     * If 0 or >= total active questions, serve ALL questions.
     * Default: 10
     */
    @Column(nullable = false)
    @Builder.Default
    private Integer questionsPerTest = 10;

    /** Randomise the order of questions per attempt. Default: true */
    @Column(nullable = false)
    @Builder.Default
    private Boolean shuffleQuestions = true;

    /** Randomise the order of options per attempt. Default: false */
    @Column(nullable = false)
    @Builder.Default
    private Boolean shuffleOptions = false;

    /**
     * If false, the verification test step is skipped entirely.
     * Sellers can upload marksheet directly.
     * Default: true
     */
    @Column(nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}

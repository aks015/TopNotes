package com.topnotes.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/** Records each attempt a seller makes at the academic verification test. */
@Entity
@Table(
    name = "verification_tests",
    indexes = {
        @Index(name = "idx_vtest_seller", columnList = "seller_id")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VerificationTest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "seller_id", nullable = false)
    private User seller;

    /** Exam category this attempt was for. NULL = legacy global attempt. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private ExamCategory category;

    /** Percentage score (0–100). */
    @Column(nullable = false)
    private Integer score;

    @Column(nullable = false)
    private Integer totalQuestions;

    @Column(nullable = false)
    private Integer correctAnswers;

    @Column(nullable = false)
    private Boolean passed;

    /** Serialised JSON of seller's submitted answers for audit trail. */
    @Column(columnDefinition = "TEXT")
    private String answersJson;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime attemptedAt;
}

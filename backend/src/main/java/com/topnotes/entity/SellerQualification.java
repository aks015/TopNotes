package com.topnotes.entity;

import com.topnotes.entity.enums.QualificationStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * A seller's qualification to sell notes in ONE exam category. One row per
 * (seller, category). An APPROVED row is what authorises uploads in that
 * category — selling scope is per-category, not global.
 */
@Entity
@Table(
    name = "seller_qualifications",
    uniqueConstraints = @UniqueConstraint(columnNames = {"seller_id", "category_id"}),
    indexes = {
        @Index(name = "idx_sq_seller", columnList = "seller_id"),
        @Index(name = "idx_sq_status", columnList = "status")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SellerQualification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "seller_id", nullable = false)
    private User seller;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id", nullable = false)
    private ExamCategory category;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private QualificationStatus status;

    /** Best test score achieved so far (0–100). */
    @Column(nullable = false)
    @Builder.Default
    private Integer bestScore = 0;

    @Column(nullable = false)
    @Builder.Default
    private Integer attemptsUsed = 0;

    private LocalDateTime lastAttemptAt;

    /** Marksheet uploaded for this category's qualification. */
    @Column(columnDefinition = "TEXT")
    private String marksheetUrl;

    @Column(columnDefinition = "TEXT")
    private String rejectionReason;

    private LocalDateTime approvedAt;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private LocalDateTime updatedAt;
}

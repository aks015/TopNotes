package com.topnotes.entity;

import com.topnotes.entity.enums.ExamType;
import com.topnotes.entity.enums.NoteStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Represents a handwritten note listing created by a verified seller.
 * Contains references to stored PDF and thumbnail files.
 */
@Entity
@Table(
    name = "notes",
    indexes = {
        @Index(name = "idx_note_seller",        columnList = "seller_id"),
        // Filter columns (browse facets).
        @Index(name = "idx_note_class",         columnList = "class_level"),
        @Index(name = "idx_note_subject",       columnList = "subject"),
        @Index(name = "idx_note_exam_type",     columnList = "exam_type"),
        @Index(name = "idx_note_category",      columnList = "category"),
        @Index(name = "idx_note_exam",          columnList = "exam"),
        // Composite (status, sort) — browse always filters status='ACTIVE' then
        // sorts; these let MySQL filter + order from one index (no filesort).
        @Index(name = "idx_note_status_created", columnList = "status, created_at"),
        @Index(name = "idx_note_status_popular", columnList = "status, purchase_count"),
        @Index(name = "idx_note_status_rating",  columnList = "status, average_rating"),
        @Index(name = "idx_note_status_price",   columnList = "status, price")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Note {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 250)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    /** Optional level/stage (e.g. "Class 12", "Prelims", "Foundation"). Reuses the legacy class_level column. */
    @Column(name = "class_level", length = 60)
    private String classLevel;

    /** Exam category name, denormalised from the taxonomy (e.g. "Civil Services"). */
    @Column(length = 100)
    private String category;

    /** Exam name, denormalised from the taxonomy (e.g. "UPSC CSE"). */
    @Column(length = 120)
    private String exam;

    @Column(length = 120)
    private String subject;

    /** Legacy enum — superseded by the dynamic {@link #exam}/{@link #category} taxonomy. Kept for old data. */
    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private ExamType examType;

    /**
     * Price in INR. BigDecimal used to avoid floating-point errors.
     */
    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal price;

    /** Relative path to the full PDF in the upload directory. */
    @Column(columnDefinition = "TEXT")
    private String pdfUrl;

    /** Relative path to the cover/thumbnail image. */
    @Column(columnDefinition = "TEXT")
    private String thumbnailUrl;

    /** Same path as pdfUrl — controller restricts page count in response. */
    @Column(columnDefinition = "TEXT")
    private String previewUrl;

    @Column(nullable = false)
    @Builder.Default
    private Integer totalPages = 0;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private NoteStatus status = NoteStatus.ACTIVE;

    /**
     * True once an admin has approved this note's CURRENT content. It is the only
     * gate that lets a note go ACTIVE (live). Reset to false whenever the content
     * changes (PDF swap) or a fresh draft is made (clone), so a seller can never
     * push unreviewed content live by toggling visibility.
     */
    @Column(nullable = false)
    @Builder.Default
    private boolean approved = false;

    /** Admin's reason when status = REJECTED — shown to the seller so they know what to fix. Cleared on approval. */
    @Column(length = 1000)
    private String rejectionReason;

    /** Denormalised counter — incremented on each successful purchase. */
    @Column(nullable = false)
    @Builder.Default
    private Integer purchaseCount = 0;

    /** Detail-page views (by non-owners) — for seller analytics + conversion. */
    @Column(nullable = false)
    @Builder.Default
    private Integer viewCount = 0;

    /** Denormalised average — recalculated after each new review. */
    @Column(precision = 4, scale = 2)
    @Builder.Default
    private BigDecimal averageRating = BigDecimal.ZERO;

    @Column(nullable = false)
    @Builder.Default
    private Integer reviewCount = 0;

    // ── Relationships ─────────────────────────────────────────
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "seller_id", nullable = false)
    private User seller;

    @OneToMany(mappedBy = "note", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @Builder.Default
    private List<Purchase> purchases = new ArrayList<>();

    @OneToMany(mappedBy = "note", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @Builder.Default
    private List<Review> reviews = new ArrayList<>();

    // ── Audit ─────────────────────────────────────────────────
    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private LocalDateTime updatedAt;
}

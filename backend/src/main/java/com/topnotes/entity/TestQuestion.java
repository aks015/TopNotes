package com.topnotes.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * A single MCQ question in the seller verification test.
 * Questions are loaded from the database — fully configurable
 * by admin without any code changes.
 *
 * Admin can:
 *  - Add / edit / delete questions
 *  - Set which subject a question belongs to
 *  - Activate / deactivate individual questions
 *  - Set display order
 */
@Entity
@Table(name = "test_questions")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class TestQuestion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** The question text shown to the seller. */
    @Column(nullable = false, columnDefinition = "TEXT")
    private String questionText;

    /**
     * The exam-category pool this question belongs to. NULL = "General" — a
     * shared pool appended to every category's test (general aptitude). A
     * category's test draws from its own questions + the shared General pool.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private ExamCategory category;

    /**
     * Optional subject tag within the category — e.g. "Anatomy", "Polity".
     */
    @Column(length = 100)
    private String subject;

    /**
     * Display order in the test.
     * Admin can reorder questions by changing this value.
     */
    @Column(nullable = false)
    @Builder.Default
    private Integer displayOrder = 0;

    /**
     * If false, this question is skipped when building the test.
     * Admin can temporarily disable a question without deleting it.
     */
    @Column(nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    /**
     * Options for this question.
     * CascadeType.ALL — deleting a question deletes its options.
     */
    @OneToMany(mappedBy = "question",
               cascade  = CascadeType.ALL,
               orphanRemoval = true,
               fetch    = FetchType.EAGER)
    @OrderBy("optionKey ASC")
    @Builder.Default
    private List<TestOption> options = new ArrayList<>();

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private LocalDateTime updatedAt;
}

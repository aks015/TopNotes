package com.topnotes.entity;

import com.topnotes.entity.enums.AgreementType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * A versioned piece of legal text (seller agreement, originality declaration).
 * Text is never edited in place — a new version is added and marked active, so
 * the exact wording every user accepted stays reproducible. {@code contentHash}
 * is the SHA-256 of {@code body}, copied onto each acceptance for integrity.
 */
@Entity
@Table(
    name = "agreement_documents",
    uniqueConstraints = @UniqueConstraint(name = "uk_agreement_type_version", columnNames = {"type", "version"})
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AgreementDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private AgreementType type;

    @Column(nullable = false)
    private Integer version;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String body;

    /** SHA-256 hex of {@code body}. */
    @Column(nullable = false, length = 64)
    private String contentHash;

    /** Exactly one row per type should be active at a time. */
    @Column(nullable = false)
    @Builder.Default
    private Boolean active = true;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
}

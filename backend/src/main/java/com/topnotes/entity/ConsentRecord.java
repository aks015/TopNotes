package com.topnotes.entity;

import com.topnotes.entity.enums.AgreementType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Append-only, legally-defensible record that a user accepted a specific version
 * of an agreement. Never updated or deleted. Captures who, what (type + version +
 * exact-text hash), when, from where (IP / user-agent), and — for per-upload
 * originality declarations — which note it pertains to.
 */
@Entity
@Table(
    name = "consent_records",
    indexes = {
        @Index(name = "idx_consent_user_type", columnList = "user_id, agreement_type"),
        @Index(name = "idx_consent_note", columnList = "note_id")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConsentRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "agreement_type", nullable = false, length = 40)
    private AgreementType agreementType;

    @Column(nullable = false)
    private Integer version;

    /** SHA-256 of the exact agreement text accepted (matches the document at accept time). */
    @Column(nullable = false, length = 64)
    private String contentHash;

    /** Set only for per-upload declarations (which note this consent covers). */
    @Column(name = "note_id")
    private Long noteId;

    @Column(length = 45)
    private String ipAddress;

    @Column(length = 512)
    private String userAgent;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime acceptedAt;
}

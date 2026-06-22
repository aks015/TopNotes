package com.topnotes.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Short-lived one-time code emailed to a user to confirm control of their inbox.
 * The raw code is never stored — only a BCrypt hash. Codes are single-use,
 * time-boxed, and attempt-capped to resist brute force.
 */
@Entity
@Table(
    name = "email_verification_tokens",
    indexes = { @Index(name = "idx_evt_user", columnList = "user_id") }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmailVerificationToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** BCrypt hash of the 6-digit code — never store the raw code. */
    @Column(nullable = false)
    private String codeHash;

    @Column(nullable = false)
    private LocalDateTime expiresAt;

    /** Set once the code is successfully used or superseded by a newer code. */
    @Column
    private LocalDateTime consumedAt;

    @Column(nullable = false)
    @Builder.Default
    private Integer attempts = 0;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
}

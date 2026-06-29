package com.topnotes.entity;

import com.topnotes.entity.enums.UserRole;
import com.topnotes.entity.enums.UserStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Core user entity — serves all three roles (ADMIN, SELLER, BUYER)
 * via a discriminator column. Seller-specific fields are nullable
 * and only populated after verification flow.
 */
@Entity
@Table(
    name = "users",
    indexes = {
        @Index(name = "idx_user_email", columnList = "email", unique = true),
        @Index(name = "idx_user_role",  columnList = "role")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 150)
    private String email;

    /** BCrypt hashed — never exposed in responses. */
    @Column(nullable = false)
    private String password;

    @Column(nullable = false, length = 100)
    private String fullName;

    @Column(length = 15)
    private String phone;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private UserRole role;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private UserStatus status = UserStatus.ACTIVE;

    @Column(columnDefinition = "TEXT")
    private String profileImageUrl;

    /** True once the user confirms control of their email via OTP. */
    @Column(nullable = false)
    @Builder.Default
    private Boolean emailVerified = false;

    // ── Seller-specific fields ────────────────────────────────
    @Column(length = 60)
    private String classLevel;

    @Column(length = 150)
    private String institution;

    @Column(length = 600)
    private String bio;

    /** True only after admin approves both test and marksheet. */
    @Column(nullable = false)
    @Builder.Default
    private Boolean isVerified = false;

    @Column(nullable = false)
    @Builder.Default
    private Boolean testPassed = false;

    @Column
    private Integer testScore;

    @Column(columnDefinition = "TEXT")
    private String marksheetUrl;

    @Column(nullable = false)
    @Builder.Default
    private Boolean marksheetApproved = false;

    /** Seller payout destination (UPI VPA, e.g. name@bank). Collected for earnings payout. */
    @Column(length = 100)
    private String upiId;

    // ── Relationships ─────────────────────────────────────────
    @OneToMany(mappedBy = "seller", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @Builder.Default
    private List<Note> notes = new ArrayList<>();

    @OneToMany(mappedBy = "buyer", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @Builder.Default
    private List<Purchase> buyerPurchases = new ArrayList<>();

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @Builder.Default
    private List<Notification> notifications = new ArrayList<>();

    // ── Audit ─────────────────────────────────────────────────
    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private LocalDateTime updatedAt;
}

package com.topnotes.repository;

import com.topnotes.entity.EmailVerificationToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface EmailVerificationTokenRepository extends JpaRepository<EmailVerificationToken, Long> {

    /** Most recent code issued to a user (consumed or not) — drives rate-limiting and verification. */
    Optional<EmailVerificationToken> findTopByUserIdOrderByCreatedAtDesc(Long userId);

    /** Invalidate all of a user's outstanding (unconsumed) codes before issuing a new one. */
    @Modifying
    @Query("UPDATE EmailVerificationToken t SET t.consumedAt = CURRENT_TIMESTAMP " +
           "WHERE t.user.id = :userId AND t.consumedAt IS NULL")
    int consumeAllForUser(@Param("userId") Long userId);
}

package com.topnotes.repository;

import com.topnotes.entity.PayoutRequest;
import com.topnotes.entity.enums.PayoutStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;

public interface PayoutRepository extends JpaRepository<PayoutRequest, Long> {

    /** Sum of amounts in any of the given states for a seller (e.g. PENDING+PAID = already committed). */
    @Query("""
            SELECT COALESCE(SUM(p.amount), 0) FROM PayoutRequest p
            WHERE p.seller.id = :sellerId AND p.status IN :statuses
            """)
    BigDecimal sumBySellerAndStatuses(@Param("sellerId") Long sellerId,
                                      @Param("statuses") List<PayoutStatus> statuses);

    boolean existsBySellerIdAndStatus(Long sellerId, PayoutStatus status);

    Page<PayoutRequest> findByStatusOrderByRequestedAtAsc(PayoutStatus status, Pageable pageable);

    Page<PayoutRequest> findBySellerIdOrderByRequestedAtDesc(Long sellerId, Pageable pageable);

    /** Count of payouts in a given state (drives the admin stat cards + tab counts). */
    long countByStatus(PayoutStatus status);

    /** Platform-wide sum of amounts in a given state (e.g. total disbursed). */
    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM PayoutRequest p WHERE p.status = :status")
    BigDecimal sumByStatus(@Param("status") PayoutStatus status);

    /**
     * Admin payout list with optional status filter + keyword (seller name or UPI).
     * A null status returns every state; a blank keyword skips the text match.
     * Ordering comes from the Pageable so the controller can keep PENDING FIFO.
     */
    @Query("""
            SELECT p FROM PayoutRequest p
            WHERE (:status IS NULL OR p.status = :status)
              AND (:kw = '' OR LOWER(p.seller.fullName) LIKE CONCAT('%', :kw, '%')
                               OR LOWER(p.upiId)           LIKE CONCAT('%', :kw, '%'))
            """)
    Page<PayoutRequest> search(@Param("status") PayoutStatus status,
                               @Param("kw") String kw,
                               Pageable pageable);
}

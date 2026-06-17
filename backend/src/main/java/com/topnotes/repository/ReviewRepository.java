package com.topnotes.repository;

import com.topnotes.entity.Review;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Repository
public interface ReviewRepository extends JpaRepository<Review, Long> {

    Page<Review> findByNoteIdOrderByCreatedAtDesc(Long noteId, Pageable pageable);

    boolean existsByBuyerIdAndNoteId(Long buyerId, Long noteId);

    Optional<Review> findByBuyerIdAndNoteId(Long buyerId, Long noteId);

    long countByNoteId(Long noteId);

    @Query("SELECT COALESCE(AVG(CAST(r.rating AS double)), 0) FROM Review r WHERE r.note.id = :noteId")
    BigDecimal calculateAverageRatingForNote(@Param("noteId") Long noteId);

    /** Platform-wide average rating across every review (0 when there are none). */
    @Query("SELECT COALESCE(AVG(CAST(r.rating AS double)), 0) FROM Review r")
    double averageRatingAllTime();

    /** Per-star counts: each row is [rating, count]. Stars with no reviews are absent. */
    @Query("SELECT r.rating, COUNT(r) FROM Review r WHERE r.note.id = :noteId GROUP BY r.rating")
    List<Object[]> ratingDistribution(@Param("noteId") Long noteId);
}

package com.topnotes.repository;

import com.topnotes.entity.Note;
import com.topnotes.entity.enums.NoteStatus;
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
public interface NoteRepository extends JpaRepository<Note, Long> {

    Page<Note> findByStatus(NoteStatus status, Pageable pageable);

    Page<Note> findBySellerIdAndStatusNot(Long sellerId, NoteStatus status, Pageable pageable);

    Page<Note> findBySellerId(Long sellerId, Pageable pageable);

    long countBySellerId(Long sellerId);

    long countByStatus(NoteStatus status);

    Page<Note> findBySellerIdAndStatus(Long sellerId, NoteStatus status, Pageable pageable);

    /** Atomic, lock-free view increment (avoids load + dirty-check races). */
    @org.springframework.data.jpa.repository.Modifying
    @Query("UPDATE Note n SET n.viewCount = n.viewCount + 1 WHERE n.id = :id")
    void incrementViewCount(@Param("id") Long id);

    /** Revoke cascade: hide a seller's active notes in a category they're no longer approved for. */
    @org.springframework.data.jpa.repository.Modifying
    @Query("UPDATE Note n SET n.status = 'INACTIVE' WHERE n.seller.id = :sellerId AND n.category = :category AND n.status = 'ACTIVE'")
    int deactivateBySellerAndCategory(@Param("sellerId") Long sellerId, @Param("category") String category);

    /** Distinct categories a seller has notes in (for qualification migration). */
    @Query("SELECT DISTINCT n.category FROM Note n WHERE n.seller.id = :sellerId AND n.category IS NOT NULL")
    List<String> findDistinctCategoriesBySeller(@Param("sellerId") Long sellerId);

    /** Public seller profile: all live (ACTIVE) notes, grouped subject-then-newest by the caller. */
    List<Note> findBySellerIdAndStatusOrderBySubjectAscCreatedAtDesc(Long sellerId, NoteStatus status);

    long countBySellerIdAndStatus(Long sellerId, NoteStatus status);

    /** Distinct categories a seller has ACTIVE notes in (the domains shown on their public profile). */
    @Query("SELECT DISTINCT n.category FROM Note n WHERE n.seller.id = :sellerId AND n.status = 'ACTIVE' AND n.category IS NOT NULL ORDER BY n.category")
    List<String> findActiveCategoriesBySeller(@Param("sellerId") Long sellerId);

    /** Distinct subjects a seller has ACTIVE notes in. */
    @Query("SELECT DISTINCT n.subject FROM Note n WHERE n.seller.id = :sellerId AND n.status = 'ACTIVE' AND n.subject IS NOT NULL ORDER BY n.subject")
    List<String> findActiveSubjectsBySeller(@Param("sellerId") Long sellerId);

    /** Distinct exams a seller has ACTIVE notes in (shown as "Teaches" chips). */
    @Query("SELECT DISTINCT n.exam FROM Note n WHERE n.seller.id = :sellerId AND n.status = 'ACTIVE' AND n.exam IS NOT NULL ORDER BY n.exam")
    List<String> findActiveExamsBySeller(@Param("sellerId") Long sellerId);

    /** Distinct [sellerId, category] pairs across all notes — for the qualification grandfather migration. */
    @Query("SELECT DISTINCT n.seller.id, n.category FROM Note n WHERE n.category IS NOT NULL AND n.status <> 'DELETED'")
    List<Object[]> findDistinctSellerCategoryPairs();

    // ── Seller aggregate stats (across ALL the seller's notes) ──

    /** Live notes the seller owns (excludes soft-deleted) — matches the Manage-notes list. */
    @Query("SELECT COUNT(n) FROM Note n WHERE n.seller.id = :sellerId AND n.status <> 'DELETED'")
    long countLiveBySellerId(@Param("sellerId") Long sellerId);

    /** Σ(rating × reviewCount) — numerator for a review-weighted average rating. */
    @Query("SELECT COALESCE(SUM(n.averageRating * n.reviewCount), 0) FROM Note n WHERE n.seller.id = :sellerId AND n.status <> 'DELETED'")
    BigDecimal sumRatingWeightBySellerId(@Param("sellerId") Long sellerId);

    /** Σ(reviewCount) — denominator for the review-weighted average rating. */
    @Query("SELECT COALESCE(SUM(n.reviewCount), 0) FROM Note n WHERE n.seller.id = :sellerId AND n.status <> 'DELETED'")
    long sumReviewCountBySellerId(@Param("sellerId") Long sellerId);

    Optional<Note> findByIdAndSellerIdAndStatusNot(Long id, Long sellerId, NoteStatus status);

    /**
     * Full-text search across title and description with optional MULTI-value
     * filters. Each filter is skipped when its "all" flag is true; otherwise it
     * matches any value in the supplied list (the lists are never empty — the
     * service passes a dummy single-element list when a filter is inactive, so
     * the IN clause is always valid SQL).
     */
    @Query("""
            SELECT n FROM Note n
            WHERE n.status = 'ACTIVE'
              AND (:keyword = '' OR LOWER(n.title)      LIKE CONCAT('%', :keyword, '%')
                                OR LOWER(n.description) LIKE CONCAT('%', :keyword, '%'))
              AND (:allCategory = TRUE OR n.category IN :categories)
              AND (:allExam     = TRUE OR n.exam     IN :exams)
              AND (:allSubject  = TRUE OR n.subject  IN :subjects)
            """)
    Page<Note> searchNotes(
            @Param("keyword")     String       keyword,
            @Param("allCategory") boolean      allCategory,
            @Param("categories")  List<String> categories,
            @Param("allExam")     boolean      allExam,
            @Param("exams")       List<String> exams,
            @Param("allSubject")  boolean      allSubject,
            @Param("subjects")    List<String> subjects,
            Pageable pageable
    );

    @Query("SELECT DISTINCT n.category FROM Note n WHERE n.status = 'ACTIVE' AND n.category IS NOT NULL ORDER BY n.category")
    List<String> findDistinctActiveCategories();

    @Query("SELECT DISTINCT n.exam     FROM Note n WHERE n.status = 'ACTIVE' AND n.exam     IS NOT NULL ORDER BY n.exam")
    List<String> findDistinctActiveExams();

    @Query("SELECT DISTINCT n.subject  FROM Note n WHERE n.status = 'ACTIVE' AND n.subject  IS NOT NULL ORDER BY n.subject")
    List<String> findDistinctActiveSubjects();

    /** Prices of active notes for a given exam+subject — used to suggest a price (median in Java). */
    @Query("SELECT n.price FROM Note n WHERE n.status = 'ACTIVE' AND n.exam = :exam AND n.subject = :subject")
    List<BigDecimal> findActivePrices(@Param("exam") String exam, @Param("subject") String subject);
}

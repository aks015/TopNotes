package com.topnotes.repository;

import com.topnotes.entity.TestQuestion;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TestQuestionRepository extends JpaRepository<TestQuestion, Long> {

    /** All active questions ordered by displayOrder — used when building a test. */
    List<TestQuestion> findByIsActiveTrueOrderByDisplayOrderAsc();

    /** Paginated list for admin management table. */
    Page<TestQuestion> findAllByOrderByDisplayOrderAsc(Pageable pageable);

    /** Count of active questions — shown in admin UI alongside config. */
    long countByIsActiveTrue();

    /** Check if any question exists with this display order (for validation). */
    boolean existsByDisplayOrder(Integer displayOrder);

    /** Find all questions for a specific subject tag. */
    Page<TestQuestion> findBySubjectIgnoreCaseOrderByDisplayOrderAsc(String subject, Pageable pageable);

    /** Full-text search across question text — admin search bar. */
    @Query("""
            SELECT q FROM TestQuestion q
            WHERE LOWER(q.questionText) LIKE CONCAT('%', :keyword, '%')
               OR LOWER(q.subject)      LIKE CONCAT('%', :keyword, '%')
            ORDER BY q.displayOrder ASC
            """)
    Page<TestQuestion> searchByKeyword(String keyword, Pageable pageable);

    // ── Per-category pools (a category test = its own questions + shared General pool) ──

    /** Active questions for a category's test: its own pool + shared (NULL) General pool. */
    @Query("""
            SELECT q FROM TestQuestion q
            WHERE q.isActive = true AND (q.category.id = :categoryId OR q.category IS NULL)
            ORDER BY q.displayOrder ASC
            """)
    List<TestQuestion> findActiveForCategory(@Param("categoryId") Long categoryId);

    /** Count of active questions available to a category (own + shared General). */
    @Query("""
            SELECT COUNT(q) FROM TestQuestion q
            WHERE q.isActive = true AND (q.category.id = :categoryId OR q.category IS NULL)
            """)
    long countActiveForCategory(@Param("categoryId") Long categoryId);

    /** Admin management — questions in one category's own pool (excludes shared). */
    Page<TestQuestion> findByCategoryIdOrderByDisplayOrderAsc(Long categoryId, Pageable pageable);

    /** Admin management — the shared General pool (category IS NULL). */
    Page<TestQuestion> findByCategoryIsNullOrderByDisplayOrderAsc(Pageable pageable);

    long countByCategoryId(Long categoryId);
    long countByCategoryIsNull();
    long countByCategoryIsNullAndIsActiveTrue();

    /** Admin search within a category's own pool. */
    @Query("""
            SELECT q FROM TestQuestion q
            WHERE q.category.id = :cid
              AND (:kw = '' OR LOWER(q.questionText) LIKE CONCAT('%', :kw, '%')
                            OR LOWER(q.subject)      LIKE CONCAT('%', :kw, '%'))
            ORDER BY q.displayOrder ASC
            """)
    Page<TestQuestion> adminSearchInCategory(@Param("cid") Long cid, @Param("kw") String kw, Pageable pageable);

    /** Admin search within the shared General pool. */
    @Query("""
            SELECT q FROM TestQuestion q
            WHERE q.category IS NULL
              AND (:kw = '' OR LOWER(q.questionText) LIKE CONCAT('%', :kw, '%')
                            OR LOWER(q.subject)      LIKE CONCAT('%', :kw, '%'))
            ORDER BY q.displayOrder ASC
            """)
    Page<TestQuestion> adminSearchGeneral(@Param("kw") String kw, Pageable pageable);
}

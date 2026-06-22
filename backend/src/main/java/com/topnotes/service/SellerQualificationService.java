package com.topnotes.service;

import com.topnotes.dto.response.QualificationResponse;
import com.topnotes.dto.response.QualificationReviewResponse;
import com.topnotes.dto.response.SellerTestResponse;
import com.topnotes.dto.response.TestResultResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

/** Per-category seller qualification: take a category's test → marksheet → admin approval. */
public interface SellerQualificationService {

    /** The seller's status across every active category. */
    List<QualificationResponse> getMyQualifications(Long sellerId);

    /** Serve a category's test (questions stripped of answers). */
    SellerTestResponse startTest(Long sellerId, Long categoryId);

    /** Grade a submitted category test and update the qualification. */
    TestResultResponse submitTest(Long sellerId, Long categoryId, Map<Long, String> answers);

    /** Upload the marksheet (+ declared institution) for a passed category, moving it to admin review. */
    String uploadMarksheet(Long sellerId, Long categoryId, MultipartFile marksheet, String institution);

    // ── Admin ──
    Page<QualificationReviewResponse> getPendingReview(Pageable pageable);
    QualificationReviewResponse review(Long qualificationId, boolean approved, String reason);

    // ── Used by upload gating (Phase 3) ──
    boolean isApprovedFor(Long sellerId, Long categoryName);   // by category id
    List<String> approvedCategoryNames(Long sellerId);
}

package com.topnotes.service;

import com.topnotes.dto.request.ReviewRequest;
import com.topnotes.dto.response.ReviewResponse;
import com.topnotes.dto.response.ReviewStatsResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

/** Review submission and query for purchased notes. */
public interface ReviewService {
    /** Create or update the buyer's review for a note (upsert). Requires a purchase. */
    ReviewResponse submitReview(Long noteId, Long buyerId, ReviewRequest request);
    Page<ReviewResponse> getNoteReviews(Long noteId, Pageable pageable);

    /** Aggregate stats (average, total, per-star counts) from real review rows. */
    ReviewStatsResponse getReviewStats(Long noteId);

    /** The current buyer's own review for a note, or null if they haven't reviewed. */
    ReviewResponse getMyReview(Long noteId, Long buyerId);
}

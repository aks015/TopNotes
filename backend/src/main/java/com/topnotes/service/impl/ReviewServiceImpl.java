package com.topnotes.service.impl;

import com.topnotes.dto.request.ReviewRequest;
import com.topnotes.dto.response.ReviewResponse;
import com.topnotes.dto.response.ReviewStatsResponse;
import com.topnotes.entity.Note;
import com.topnotes.entity.Review;
import com.topnotes.entity.User;
import com.topnotes.exception.BadRequestException;
import com.topnotes.exception.ResourceNotFoundException;
import com.topnotes.repository.NoteRepository;
import com.topnotes.repository.PurchaseRepository;
import com.topnotes.repository.ReviewRepository;
import com.topnotes.repository.UserRepository;
import com.topnotes.service.ReviewService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

@Service
@Slf4j
public class ReviewServiceImpl implements ReviewService {

    private final ReviewRepository   reviewRepository;
    private final NoteRepository     noteRepository;
    private final UserRepository     userRepository;
    private final PurchaseRepository purchaseRepository;

    public ReviewServiceImpl(ReviewRepository reviewRepository,
                             NoteRepository noteRepository,
                             UserRepository userRepository,
                             PurchaseRepository purchaseRepository) {
        this.reviewRepository   = reviewRepository;
        this.noteRepository     = noteRepository;
        this.userRepository     = userRepository;
        this.purchaseRepository = purchaseRepository;
    }

    @Override
    @Transactional
    public ReviewResponse submitReview(Long noteId, Long buyerId, ReviewRequest request) {
        // Must have purchased the note first
        if (!purchaseRepository.existsByBuyerIdAndNoteId(buyerId, noteId)) {
            throw new BadRequestException("You must purchase this note before reviewing it");
        }

        Note note = noteRepository.findById(noteId)
                .orElseThrow(() -> new ResourceNotFoundException("Note", noteId));

        // Upsert: update the existing review if the buyer already reviewed, else create one.
        Review review = reviewRepository.findByBuyerIdAndNoteId(buyerId, noteId).orElse(null);
        if (review == null) {
            User buyer = userRepository.findById(buyerId)
                    .orElseThrow(() -> new ResourceNotFoundException("User", buyerId));
            review = Review.builder().note(note).buyer(buyer).build();
        }
        review.setRating(request.getRating());
        review.setComment(request.getComment());

        Review saved = reviewRepository.save(review);

        // Recalculate and persist denormalised average rating
        recalculateRating(note);

        log.info("Review id={} saved for note id={} by buyer id={}", saved.getId(), noteId, buyerId);
        return toResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<ReviewResponse> getNoteReviews(Long noteId, Pageable pageable) {
        return reviewRepository
                .findByNoteIdOrderByCreatedAtDesc(noteId, pageable)
                .map(this::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public ReviewStatsResponse getReviewStats(Long noteId) {
        java.util.Map<Integer, Long> counts = new java.util.LinkedHashMap<>();
        for (int star = 5; star >= 1; star--) {
            counts.put(star, 0L);
        }
        for (Object[] row : reviewRepository.ratingDistribution(noteId)) {
            int star = ((Number) row[0]).intValue();
            long cnt = ((Number) row[1]).longValue();
            if (star >= 1 && star <= 5) {
                counts.put(star, cnt);
            }
        }
        BigDecimal avg = reviewRepository.calculateAverageRatingForNote(noteId);
        return ReviewStatsResponse.builder()
                .average(avg != null ? avg.setScale(2, java.math.RoundingMode.HALF_UP) : BigDecimal.ZERO)
                .total(reviewRepository.countByNoteId(noteId))
                .counts(counts)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public ReviewResponse getMyReview(Long noteId, Long buyerId) {
        return reviewRepository.findByBuyerIdAndNoteId(buyerId, noteId).map(this::toResponse).orElse(null);
    }

    // ── Private helpers ───────────────────────────────────────

    private void recalculateRating(Note note) {
        BigDecimal avg   = reviewRepository.calculateAverageRatingForNote(note.getId());
        long       count = reviewRepository.countByNoteId(note.getId());

        note.setAverageRating(avg != null ? avg.setScale(2, java.math.RoundingMode.HALF_UP) : BigDecimal.ZERO);
        note.setReviewCount((int) count);
        noteRepository.save(note);
    }

    private ReviewResponse toResponse(Review r) {
        return ReviewResponse.builder()
                .id(r.getId())
                .buyerName(r.getBuyer().getFullName())
                .rating(r.getRating())
                .comment(r.getComment())
                .createdAt(r.getCreatedAt())
                .build();
    }
}

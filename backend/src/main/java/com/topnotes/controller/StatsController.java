package com.topnotes.controller;

import com.topnotes.dto.response.ApiResponse;
import com.topnotes.dto.response.SocialStatsResponse;
import com.topnotes.entity.enums.NoteStatus;
import com.topnotes.entity.enums.UserRole;
import com.topnotes.repository.NoteRepository;
import com.topnotes.repository.PurchaseRepository;
import com.topnotes.repository.ReviewRepository;
import com.topnotes.repository.UserRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** Public, real social-proof numbers for the landing page (no hardcoded marketing values). */
@RestController
@Tag(name = "Stats", description = "Public platform statistics")
public class StatsController {

    private final ReviewRepository   reviewRepository;
    private final PurchaseRepository purchaseRepository;
    private final NoteRepository     noteRepository;
    private final UserRepository     userRepository;

    public StatsController(ReviewRepository reviewRepository,
                           PurchaseRepository purchaseRepository,
                           NoteRepository noteRepository,
                           UserRepository userRepository) {
        this.reviewRepository   = reviewRepository;
        this.purchaseRepository = purchaseRepository;
        this.noteRepository     = noteRepository;
        this.userRepository     = userRepository;
    }

    @GetMapping("/stats/social")
    @Operation(summary = "Live social-proof stats for the landing hero")
    public ResponseEntity<ApiResponse<SocialStatsResponse>> social() {
        BigDecimal avg = BigDecimal.valueOf(reviewRepository.averageRatingAllTime())
                .setScale(1, RoundingMode.HALF_UP);
        SocialStatsResponse stats = new SocialStatsResponse(
                avg,
                reviewRepository.count(),
                purchaseRepository.countDistinctBuyers(),
                noteRepository.countByStatus(NoteStatus.ACTIVE),
                userRepository.countByRole(UserRole.SELLER),
                userRepository.countByRoleAndIsVerifiedTrue(UserRole.SELLER),
                purchaseRepository.countCompleted());
        return ResponseEntity.ok(ApiResponse.success(stats));
    }
}

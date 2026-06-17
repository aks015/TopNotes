package com.topnotes.controller;

import com.topnotes.dto.request.ReviewRequest;
import com.topnotes.dto.request.PaymentVerifyRequest;
import com.topnotes.dto.response.*;
import com.topnotes.security.CustomUserDetails;
import com.topnotes.service.PaymentService;
import com.topnotes.service.PurchaseService;
import com.topnotes.service.ReviewService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * All buyer-specific actions:
 *   - Purchase a note
 *   - View purchase history
 *   - Submit and read reviews
 */
@RestController
@RequestMapping("/buyer")
@PreAuthorize("hasAnyRole('BUYER','SELLER')")
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Buyer", description = "Buyer purchase and review operations (any non-admin user can buy)")
public class BuyerController {

    private final PurchaseService purchaseService;
    private final PaymentService paymentService;
    private final ReviewService   reviewService;

    public BuyerController(PurchaseService purchaseService,
                           PaymentService paymentService,
                           ReviewService reviewService) {
        this.purchaseService = purchaseService;
        this.paymentService = paymentService;
        this.reviewService   = reviewService;
    }

    // ── Purchases ─────────────────────────────────────────────

    @PostMapping("/purchase/{noteId}")
    @Operation(summary = "Purchase a note — triggers revenue split and notifications")
    public ResponseEntity<ApiResponse<PurchaseResponse>> purchaseNote(
            @PathVariable Long noteId,
            @AuthenticationPrincipal CustomUserDetails principal) {

        PurchaseResponse response = purchaseService.purchaseNote(noteId, principal.getId());
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.success("Purchase successful", response));
    }

    @PostMapping("/payments/order/{noteId}")
    @Operation(summary = "Create a payment order for Razorpay Checkout")
    public ResponseEntity<ApiResponse<PaymentOrderResponse>> createPaymentOrder(
            @PathVariable Long noteId,
            @AuthenticationPrincipal CustomUserDetails principal) {

        PaymentOrderResponse response = paymentService.createOrder(noteId, principal.getId());
        return ResponseEntity.ok(ApiResponse.success("Payment order created", response));
    }

    @PostMapping("/payments/verify")
    @Operation(summary = "Verify payment signature and unlock purchased note")
    public ResponseEntity<ApiResponse<PurchaseResponse>> verifyPayment(
            @Valid @RequestBody PaymentVerifyRequest request,
            @AuthenticationPrincipal CustomUserDetails principal) {

        PurchaseResponse response = paymentService.verifyAndComplete(request, principal.getId());
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.success("Payment verified. Purchase successful", response));
    }

    @GetMapping("/purchases")
    @Operation(summary = "Get paginated list of buyer's purchases")
    public ResponseEntity<ApiResponse<Page<PurchaseResponse>>> getMyPurchases(
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "10") int size,
            @AuthenticationPrincipal CustomUserDetails principal) {

        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "purchasedAt"));
        Page<PurchaseResponse> purchases = purchaseService.getBuyerPurchases(principal.getId(), pageable);
        return ResponseEntity.ok(ApiResponse.success(purchases));
    }

    // ── Reviews ───────────────────────────────────────────────

    @PostMapping("/notes/{noteId}/review")
    @Operation(summary = "Submit a star review for a purchased note")
    public ResponseEntity<ApiResponse<ReviewResponse>> submitReview(
            @PathVariable Long noteId,
            @Valid @RequestBody ReviewRequest request,
            @AuthenticationPrincipal CustomUserDetails principal) {

        ReviewResponse review = reviewService.submitReview(noteId, principal.getId(), request);
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.success("Review submitted successfully", review));
    }

    @GetMapping("/notes/{noteId}/reviews")
    @Operation(summary = "Get paginated reviews for a note (buyer must have purchased it)")
    public ResponseEntity<ApiResponse<Page<ReviewResponse>>> getNoteReviews(
            @PathVariable Long noteId,
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "10") int size) {

        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<ReviewResponse> reviews = reviewService.getNoteReviews(noteId, pageable);
        return ResponseEntity.ok(ApiResponse.success(reviews));
    }

    @GetMapping("/notes/{noteId}/my-review")
    @Operation(summary = "The current buyer's own review for a note (null if none) — used to edit")
    public ResponseEntity<ApiResponse<ReviewResponse>> myReview(
            @PathVariable Long noteId,
            @AuthenticationPrincipal CustomUserDetails principal) {

        return ResponseEntity.ok(ApiResponse.success(reviewService.getMyReview(noteId, principal.getId())));
    }
}

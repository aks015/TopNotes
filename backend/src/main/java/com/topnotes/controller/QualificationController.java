package com.topnotes.controller;

import com.topnotes.dto.response.*;
import com.topnotes.security.CustomUserDetails;
import com.topnotes.service.SellerQualificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

/**
 * Per-category seller qualification: take a category's test, upload its marksheet,
 * and (admin) review. Selling in a category requires an APPROVED qualification.
 */
@RestController
@Tag(name = "Qualifications", description = "Per-category seller qualification")
@SecurityRequirement(name = "bearerAuth")
public class QualificationController {

    private final SellerQualificationService service;

    public QualificationController(SellerQualificationService service) {
        this.service = service;
    }

    // ── Seller ────────────────────────────────────────────────

    @GetMapping("/seller/qualifications")
    @PreAuthorize("hasRole('SELLER')")
    @Operation(summary = "My qualification status across every category")
    public ResponseEntity<ApiResponse<List<QualificationResponse>>> myQualifications(
            @AuthenticationPrincipal CustomUserDetails me) {
        return ResponseEntity.ok(ApiResponse.success(service.getMyQualifications(me.getId())));
    }

    @GetMapping("/seller/eligible-categories")
    @PreAuthorize("hasRole('SELLER')")
    @Operation(summary = "Categories the seller is APPROVED to upload notes in (drives the upload dropdown)")
    public ResponseEntity<ApiResponse<List<String>>> eligibleCategories(
            @AuthenticationPrincipal CustomUserDetails me) {
        return ResponseEntity.ok(ApiResponse.success(service.approvedCategoryNames(me.getId())));
    }

    @GetMapping("/seller/qualifications/{categoryId}/test")
    @PreAuthorize("hasRole('SELLER')")
    @Operation(summary = "Start a category's test (answers stripped)")
    public ResponseEntity<ApiResponse<SellerTestResponse>> startTest(
            @PathVariable Long categoryId, @AuthenticationPrincipal CustomUserDetails me) {
        return ResponseEntity.ok(ApiResponse.success(service.startTest(me.getId(), categoryId)));
    }

    @PostMapping("/seller/qualifications/{categoryId}/test/submit")
    @PreAuthorize("hasRole('SELLER')")
    @Operation(summary = "Submit a category test for grading")
    public ResponseEntity<ApiResponse<TestResultResponse>> submitTest(
            @PathVariable Long categoryId,
            @RequestBody Map<Long, String> answers,
            @AuthenticationPrincipal CustomUserDetails me) {
        return ResponseEntity.ok(ApiResponse.success(service.submitTest(me.getId(), categoryId, answers)));
    }

    @PostMapping(value = "/seller/qualifications/{categoryId}/marksheet", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('SELLER')")
    @Operation(summary = "Upload the marksheet for a passed category")
    public ResponseEntity<ApiResponse<String>> uploadMarksheet(
            @PathVariable Long categoryId,
            @RequestPart("marksheet") MultipartFile marksheet,
            @RequestParam(value = "institution", required = false) String institution,
            @AuthenticationPrincipal CustomUserDetails me) {
        String msg = service.uploadMarksheet(me.getId(), categoryId, marksheet, institution);
        return ResponseEntity.ok(ApiResponse.success(msg, msg));
    }

    // ── Admin ─────────────────────────────────────────────────

    @GetMapping("/admin/qualifications/pending")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Qualifications awaiting admin review")
    public ResponseEntity<ApiResponse<Page<QualificationReviewResponse>>> pending(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, size);
        return ResponseEntity.ok(ApiResponse.success(service.getPendingReview(pageable)));
    }

    @PostMapping("/admin/qualifications/{id}/review")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Approve or reject a qualification")
    public ResponseEntity<ApiResponse<QualificationReviewResponse>> review(
            @PathVariable Long id,
            @RequestParam boolean approved,
            @RequestParam(required = false) String reason) {
        return ResponseEntity.ok(ApiResponse.success(
                approved ? "Qualification approved" : "Qualification rejected",
                service.review(id, approved, reason)));
    }
}

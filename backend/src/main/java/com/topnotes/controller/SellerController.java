package com.topnotes.controller;

import com.topnotes.dto.response.*;
import com.topnotes.security.CustomUserDetails;
import com.topnotes.service.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

/**
 * Seller-specific operations:
 *   - Dashboard analytics
 *   - Own notes and sales listing
 *   - Verification test and marksheet upload
 */
@RestController
@RequestMapping("/seller")
@PreAuthorize("hasRole('SELLER')")
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Seller", description = "Seller dashboard, notes, and verification operations")
public class SellerController {

    private final DashboardService          dashboardService;
    private final NoteService               noteService;
    private final PurchaseService           purchaseService;
    private final SellerVerificationService verificationService;

    public SellerController(DashboardService dashboardService,
                            NoteService noteService,
                            PurchaseService purchaseService,
                            SellerVerificationService verificationService) {
        this.dashboardService    = dashboardService;
        this.noteService         = noteService;
        this.purchaseService     = purchaseService;
        this.verificationService = verificationService;
    }

    // ── Dashboard ─────────────────────────────────────────────

    @GetMapping("/dashboard")
    @Operation(summary = "Get seller analytics dashboard — earnings, charts, recent notes")
    public ResponseEntity<ApiResponse<SellerDashboardResponse>> getDashboard(
            @AuthenticationPrincipal CustomUserDetails principal) {

        return ResponseEntity.ok(ApiResponse.success(
                dashboardService.getSellerDashboard(principal.getId())));
    }

    // ── Own notes ─────────────────────────────────────────────

    @GetMapping("/notes")
    @Operation(summary = "Get paginated list of seller's own notes")
    public ResponseEntity<ApiResponse<Page<NoteResponse>>> getMyNotes(
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "10") int size,
            @AuthenticationPrincipal CustomUserDetails principal) {

        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        return ResponseEntity.ok(ApiResponse.success(
                noteService.getSellerNotes(principal.getId(), pageable)));
    }

    @GetMapping("/notes/trash")
    @Operation(summary = "Soft-deleted notes the seller can restore")
    public ResponseEntity<ApiResponse<Page<NoteResponse>>> getTrash(
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal CustomUserDetails principal) {

        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "updatedAt"));
        return ResponseEntity.ok(ApiResponse.success(
                noteService.getSellerTrash(principal.getId(), pageable)));
    }

    // ── Sales history ─────────────────────────────────────────

    @GetMapping("/sales")
    @Operation(summary = "Get paginated list of seller's sales (purchases of their notes)")
    public ResponseEntity<ApiResponse<Page<PurchaseResponse>>> getMySales(
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "10") int size,
            @AuthenticationPrincipal CustomUserDetails principal) {

        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "purchasedAt"));
        return ResponseEntity.ok(ApiResponse.success(
                purchaseService.getSellerSales(principal.getId(), pageable)));
    }

    // ── Verification: Test ────────────────────────────────────

    @GetMapping("/verification/test")
    @Operation(summary = "Retrieve MCQ test questions (answers stripped)")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getTestQuestions(
            @AuthenticationPrincipal CustomUserDetails principal) {

        return ResponseEntity.ok(ApiResponse.success(
                verificationService.getTestQuestions(principal.getId())));
    }

    @PostMapping("/verification/test/submit")
    @Operation(summary = "Submit test answers — returns score and pass/fail result")
    public ResponseEntity<ApiResponse<Map<String, Object>>> submitTest(
            @RequestBody Map<Integer, String> answers,
            @AuthenticationPrincipal CustomUserDetails principal) {

        Map<String, Object> result = verificationService.submitTest(principal.getId(), answers);
        return ResponseEntity.ok(ApiResponse.success("Test submitted", result));
    }

    // ── Verification: Marksheet ───────────────────────────────

    @PostMapping(value = "/verification/marksheet",
                 consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Upload marksheet image for admin review")
    public ResponseEntity<ApiResponse<String>> uploadMarksheet(
            @RequestPart("marksheet") MultipartFile marksheet,
            @AuthenticationPrincipal CustomUserDetails principal) {

        String message = verificationService.uploadMarksheet(principal.getId(), marksheet);
        return ResponseEntity.ok(ApiResponse.success(message));
    }

    @GetMapping("/verification/status")
    @Operation(summary = "Get current verification status of the seller")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getVerificationStatus(
            @AuthenticationPrincipal CustomUserDetails principal) {

        Long id = principal.getId();
        Map<String, Object> status = Map.of(
                "testPassed",        verificationService.hasPassedTest(id),
                "marksheetUploaded", verificationService.hasUploadedMarksheet(id),
                "isVerified",        verificationService.isVerified(id)
        );
        return ResponseEntity.ok(ApiResponse.success(status));
    }
}

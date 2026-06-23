package com.topnotes.controller;

import com.topnotes.dto.request.NoteCreateRequest;
import com.topnotes.dto.request.PriceUpdateRequest;
import com.topnotes.dto.response.ApiResponse;
import com.topnotes.dto.response.NoteResponse;
import com.topnotes.dto.response.ReviewResponse;
import com.topnotes.dto.response.ReviewStatsResponse;
import com.topnotes.exception.UnauthorizedException;
import com.topnotes.security.CustomUserDetails;
import com.topnotes.service.NoteService;
import com.topnotes.service.PurchaseService;
import com.topnotes.service.ReviewService;
import com.topnotes.util.FileUploadUtil;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;

/**
 * Note CRUD, search, preview, and secure full-view endpoints.
 *
 * Public:  GET /notes, GET /notes/{id}, GET /notes/{id}/preview, GET /notes/filters
 * SELLER:  POST /notes, PATCH /notes/{id}/price, DELETE /notes/{id}
 * BUYER:   GET /notes/{id}/view  (requires purchase)
 */
@RestController
@RequestMapping("/notes")
@Tag(name = "Notes", description = "Note listing management and secure content serving")
public class NoteController {

    private final NoteService     noteService;
    private final PurchaseService purchaseService;
    private final ReviewService   reviewService;
    private final FileUploadUtil  fileUploadUtil;

    public NoteController(NoteService noteService,
                          PurchaseService purchaseService,
                          ReviewService reviewService,
                          FileUploadUtil fileUploadUtil) {
        this.noteService     = noteService;
        this.purchaseService = purchaseService;
        this.reviewService   = reviewService;
        this.fileUploadUtil  = fileUploadUtil;
    }

    // ── Public: Browse ────────────────────────────────────────

    @GetMapping
    @Operation(summary = "Search/browse notes with optional filters and pagination")
    public ResponseEntity<ApiResponse<Page<NoteResponse>>> searchNotes(
            @RequestParam(required = false) String       keyword,
            @RequestParam(required = false) List<String> category,
            @RequestParam(required = false) List<String> exam,
            @RequestParam(required = false) List<String> subject,
            @RequestParam(required = false) String       sort,
            @RequestParam(defaultValue = "0")  int   page,
            @RequestParam(defaultValue = "12") int   size,
            @AuthenticationPrincipal CustomUserDetails principal) {

        Long viewerId = (principal != null) ? principal.getId() : null;
        Pageable pageable = PageRequest.of(page, size, resolveSort(sort));

        // Spring binds repeated (?subject=A&subject=B) or comma-joined (?subject=A,B) params.
        Page<NoteResponse> result = noteService.searchNotes(
                keyword, category, exam, subject, pageable, viewerId);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /** Maps the browse "Sort:" dropdown value to a JPA Sort. Default = most popular. */
    private Sort resolveSort(String sort) {
        return switch (sort == null ? "" : sort) {
            case "rating"    -> Sort.by(Sort.Direction.DESC, "averageRating").and(Sort.by(Sort.Direction.DESC, "purchaseCount"));
            case "priceAsc"  -> Sort.by(Sort.Direction.ASC,  "price");
            case "priceDesc" -> Sort.by(Sort.Direction.DESC, "price");
            case "newest"    -> Sort.by(Sort.Direction.DESC, "createdAt");
            // "Featured" (landing showcase): best sellers that are also best-rated.
            case "featured"  -> Sort.by(Sort.Direction.DESC, "purchaseCount")
                                     .and(Sort.by(Sort.Direction.DESC, "averageRating"))
                                     .and(Sort.by(Sort.Direction.DESC, "createdAt"));
            // "Most popular" (default): most sales first, newest as tie-breaker.
            default          -> Sort.by(Sort.Direction.DESC, "purchaseCount").and(Sort.by(Sort.Direction.DESC, "createdAt"));
        };
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get single note details by ID")
    public ResponseEntity<ApiResponse<NoteResponse>> getNote(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails principal) {

        Long viewerId = (principal != null) ? principal.getId() : null;
        return ResponseEntity.ok(ApiResponse.success(noteService.getNoteById(id, viewerId)));
    }

    @GetMapping("/filters")
    @Operation(summary = "Get available filter options for categories, exams and subjects")
    public ResponseEntity<ApiResponse<Map<String, List<String>>>> getFilterOptions() {
        return ResponseEntity.ok(ApiResponse.success(noteService.getFilterOptions()));
    }

    @GetMapping("/price-suggestion")
    @Operation(summary = "Median price of comparable active notes (same exam + subject)")
    public ResponseEntity<ApiResponse<com.topnotes.dto.response.PriceSuggestionResponse>> getPriceSuggestion(
            @RequestParam String exam,
            @RequestParam String subject) {
        return ResponseEntity.ok(ApiResponse.success(noteService.getPriceSuggestion(exam, subject)));
    }

    // ── Public: Reviews (read) ────────────────────────────────

    @GetMapping("/{id}/reviews")
    @Operation(summary = "Public paginated reviews for a note")
    public ResponseEntity<ApiResponse<Page<ReviewResponse>>> getReviews(
            @PathVariable Long id,
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "10") int size) {

        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        return ResponseEntity.ok(ApiResponse.success(reviewService.getNoteReviews(id, pageable)));
    }

    @GetMapping("/{id}/reviews/stats")
    @Operation(summary = "Public aggregate review stats (average, total, per-star counts)")
    public ResponseEntity<ApiResponse<ReviewStatsResponse>> getReviewStats(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(reviewService.getReviewStats(id)));
    }

    // ── Public: First-page PDF Preview ───────────────────────

    /** Number of leading pages exposed for free in the public preview. */
    private static final int PREVIEW_PAGES = 3;

    @GetMapping("/{id}/preview")
    @Operation(summary = "Stream the first few pages of the note as an inline PDF preview")
    public ResponseEntity<byte[]> getPreview(@PathVariable Long id) {
        NoteResponse note = noteService.getNoteById(id, null);
        String url = note.getPreviewUrl();
        if (url == null || url.isBlank()) {
            return ResponseEntity.notFound().build();
        }
        try {
            byte[] firstPages = extractFirstPages(fileUploadUtil.readFileBytes(url), PREVIEW_PAGES);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_PDF);
            headers.setContentDisposition(ContentDisposition.inline().build());
            headers.set("Cache-Control", "no-store");
            headers.set("X-Content-Type-Options", "nosniff");
            return ResponseEntity.ok().headers(headers).body(firstPages);
        } catch (Exception e) {
            // No real PDF behind this note (e.g. seed data) → let the SPA fall back.
            return ResponseEntity.notFound().build();
        }
    }

    /** Returns a new PDF containing only the first {@code max} pages of the source. */
    private byte[] extractFirstPages(byte[] source, int max) throws IOException {
        try (org.apache.pdfbox.pdmodel.PDDocument doc = org.apache.pdfbox.Loader.loadPDF(source)) {
            while (doc.getNumberOfPages() > max) {
                doc.removePage(doc.getNumberOfPages() - 1);
            }
            java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
            doc.save(out);
            return out.toByteArray();
        }
    }

    // ── BUYER: Secure full-note view ──────────────────────────

    @GetMapping("/{id}/view")
    @PreAuthorize("hasAnyRole('BUYER','SELLER')")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Securely stream purchased note PDF inline (requires purchase)")
    public ResponseEntity<byte[]> viewPurchasedNote(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails principal) {

        Long buyerId = principal.getId();

        if (!purchaseService.hasBuyerPurchasedNote(buyerId, id)) {
            throw new UnauthorizedException("You have not purchased this note");
        }

        NoteResponse note = noteService.getNoteById(id, buyerId);
        if (note.getPreviewUrl() == null) {
            return ResponseEntity.notFound().build();
        }
        return servePdfInline(note.getPreviewUrl());
    }

    // ── SELLER: Upload new note ───────────────────────────────

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('SELLER')")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Upload a new handwritten note (SELLER only)")
    public ResponseEntity<ApiResponse<NoteResponse>> createNote(
            @RequestPart("data")                       @Valid NoteCreateRequest request,
            @RequestPart("pdf")                               MultipartFile     pdf,
            @RequestPart(value = "thumbnail", required = false) MultipartFile   thumbnail,
            @AuthenticationPrincipal CustomUserDetails principal) {

        NoteResponse created = noteService.createNote(request, pdf, thumbnail, principal.getId());
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.success("Note uploaded successfully", created));
    }

    // ── SELLER: Edit listing ──────────────────────────────────

    @PutMapping(value = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('SELLER')")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Edit a listing's fields, optionally replacing the PDF/cover (SELLER — own notes only)")
    public ResponseEntity<ApiResponse<NoteResponse>> updateNote(
            @PathVariable Long id,
            @RequestPart("data")                                @Valid com.topnotes.dto.request.NoteUpdateRequest request,
            @RequestPart(value = "pdf",       required = false)       MultipartFile pdf,
            @RequestPart(value = "thumbnail", required = false)       MultipartFile thumbnail,
            @AuthenticationPrincipal CustomUserDetails principal) {

        NoteResponse updated = noteService.updateNote(id, request, pdf, thumbnail, principal.getId());
        return ResponseEntity.ok(ApiResponse.success("Listing updated", updated));
    }

    // ── SELLER: Update price ──────────────────────────────────

    @PatchMapping("/{id}/price")
    @PreAuthorize("hasRole('SELLER')")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Update note price (SELLER — own notes only)")
    public ResponseEntity<ApiResponse<NoteResponse>> updatePrice(
            @PathVariable Long id,
            @Valid @RequestBody PriceUpdateRequest request,
            @AuthenticationPrincipal CustomUserDetails principal) {

        NoteResponse updated = noteService.updatePrice(id, request, principal.getId());
        return ResponseEntity.ok(ApiResponse.success("Price updated successfully", updated));
    }

    @PatchMapping("/{id}/visibility")
    @PreAuthorize("hasRole('SELLER')")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Publish/unpublish a listing (SELLER — own notes only)")
    public ResponseEntity<ApiResponse<NoteResponse>> setVisibility(
            @PathVariable Long id,
            @RequestParam boolean active,
            @AuthenticationPrincipal CustomUserDetails principal) {

        NoteResponse updated = noteService.setVisibility(id, active, principal.getId());
        return ResponseEntity.ok(ApiResponse.success(active ? "Listing published" : "Listing hidden", updated));
    }

    @PostMapping("/{id}/clone")
    @PreAuthorize("hasRole('SELLER')")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Duplicate a listing as a hidden draft (SELLER — own notes only)")
    public ResponseEntity<ApiResponse<NoteResponse>> cloneNote(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails principal) {

        NoteResponse clone = noteService.cloneNote(id, principal.getId());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success("Listing cloned", clone));
    }

    @PatchMapping("/{id}/restore")
    @PreAuthorize("hasRole('SELLER')")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Restore a soft-deleted listing (SELLER — own notes only)")
    public ResponseEntity<ApiResponse<NoteResponse>> restoreNote(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails principal) {

        NoteResponse restored = noteService.restoreNote(id, principal.getId());
        return ResponseEntity.ok(ApiResponse.success("Listing restored", restored));
    }

    // ── SELLER: Delete note ───────────────────────────────────

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SELLER')")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Soft-delete a note (SELLER — own notes only)")
    public ResponseEntity<ApiResponse<Void>> deleteNote(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails principal) {

        noteService.deleteNote(id, principal.getId());
        return ResponseEntity.ok(ApiResponse.success("Note deleted successfully"));
    }

    @DeleteMapping("/{id}/permanent")
    @PreAuthorize("hasRole('SELLER')")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Permanently delete a trashed note (SELLER — own, unsold notes only)")
    public ResponseEntity<ApiResponse<Void>> permanentlyDeleteNote(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails principal) {

        noteService.permanentlyDeleteNote(id, principal.getId());
        return ResponseEntity.ok(ApiResponse.success("Note permanently deleted"));
    }

    // ── Private: Secure PDF response builder ──────────────────

    /**
     * Serves PDF bytes as an inline response with headers that prevent
     * browser download, caching, and iframe embedding on other origins.
     */
    private ResponseEntity<byte[]> servePdfInline(String relativeUrl) {
        try {
            byte[] bytes = fileUploadUtil.readFileBytes(relativeUrl);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_PDF);
            headers.setContentDisposition(ContentDisposition.inline().build());
            // Content protection headers
            headers.set("Cache-Control",        "no-store, no-cache, must-revalidate, max-age=0");
            headers.set("Pragma",               "no-cache");
            headers.set("X-Content-Type-Options","nosniff");
            headers.set("X-Frame-Options",      "SAMEORIGIN");
            headers.set("X-Download-Options",   "noopen");
            headers.set("Content-Security-Policy","default-src 'none'");

            return ResponseEntity.ok().headers(headers).body(bytes);

        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}

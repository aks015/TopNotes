package com.topnotes.controller;

import com.topnotes.dto.request.TaxonomyNameRequest;
import com.topnotes.dto.response.ApiResponse;
import com.topnotes.dto.response.TaxonomyResponse;
import com.topnotes.service.TaxonomyService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * Exam taxonomy (Category → Exam → Subject).
 *   Public: GET /taxonomy            — active entries for upload/browse dropdowns
 *   Admin:  /admin/taxonomy/**        — full CRUD (manage exam families without redeploy)
 */
@RestController
@Tag(name = "Taxonomy", description = "Admin-configurable exam categories, exams and subjects")
public class TaxonomyController {

    private final TaxonomyService taxonomyService;

    public TaxonomyController(TaxonomyService taxonomyService) {
        this.taxonomyService = taxonomyService;
    }

    // ── Public ────────────────────────────────────────────────

    @GetMapping("/taxonomy")
    @Operation(summary = "Active exam taxonomy for the upload/browse cascade")
    public ResponseEntity<ApiResponse<TaxonomyResponse>> getTaxonomy() {
        return ResponseEntity.ok(ApiResponse.success(taxonomyService.getPublicTaxonomy()));
    }

    // ── Admin: read full ──────────────────────────────────────

    @GetMapping("/admin/taxonomy")
    @PreAuthorize("hasRole('ADMIN')")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Full taxonomy incl. disabled entries (ADMIN)")
    public ResponseEntity<ApiResponse<TaxonomyResponse>> getFullTaxonomy() {
        return ResponseEntity.ok(ApiResponse.success(taxonomyService.getFullTaxonomy()));
    }

    // ── Admin: categories ─────────────────────────────────────

    @PostMapping("/admin/taxonomy/categories")
    @PreAuthorize("hasRole('ADMIN')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<ApiResponse<TaxonomyResponse>> createCategory(@Valid @RequestBody TaxonomyNameRequest req) {
        return ResponseEntity.ok(ApiResponse.success("Category added", taxonomyService.createCategory(req)));
    }

    @PutMapping("/admin/taxonomy/categories/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<ApiResponse<TaxonomyResponse>> updateCategory(@PathVariable Long id,
                                                                        @Valid @RequestBody TaxonomyNameRequest req) {
        return ResponseEntity.ok(ApiResponse.success("Category updated", taxonomyService.updateCategory(id, req)));
    }

    @DeleteMapping("/admin/taxonomy/categories/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<ApiResponse<TaxonomyResponse>> deleteCategory(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success("Category removed", taxonomyService.deleteCategory(id)));
    }

    // ── Admin: exams ──────────────────────────────────────────

    @PostMapping("/admin/taxonomy/categories/{categoryId}/exams")
    @PreAuthorize("hasRole('ADMIN')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<ApiResponse<TaxonomyResponse>> createExam(@PathVariable Long categoryId,
                                                                    @Valid @RequestBody TaxonomyNameRequest req) {
        return ResponseEntity.ok(ApiResponse.success("Exam added", taxonomyService.createExam(categoryId, req)));
    }

    @PutMapping("/admin/taxonomy/exams/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<ApiResponse<TaxonomyResponse>> updateExam(@PathVariable Long id,
                                                                    @Valid @RequestBody TaxonomyNameRequest req) {
        return ResponseEntity.ok(ApiResponse.success("Exam updated", taxonomyService.updateExam(id, req)));
    }

    @DeleteMapping("/admin/taxonomy/exams/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<ApiResponse<TaxonomyResponse>> deleteExam(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success("Exam removed", taxonomyService.deleteExam(id)));
    }

    // ── Admin: subjects ───────────────────────────────────────

    @PostMapping("/admin/taxonomy/exams/{examId}/subjects")
    @PreAuthorize("hasRole('ADMIN')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<ApiResponse<TaxonomyResponse>> createSubject(@PathVariable Long examId,
                                                                       @Valid @RequestBody TaxonomyNameRequest req) {
        return ResponseEntity.ok(ApiResponse.success("Subject added", taxonomyService.createSubject(examId, req)));
    }

    @PutMapping("/admin/taxonomy/subjects/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<ApiResponse<TaxonomyResponse>> updateSubject(@PathVariable Long id,
                                                                       @Valid @RequestBody TaxonomyNameRequest req) {
        return ResponseEntity.ok(ApiResponse.success("Subject updated", taxonomyService.updateSubject(id, req)));
    }

    @DeleteMapping("/admin/taxonomy/subjects/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<ApiResponse<TaxonomyResponse>> deleteSubject(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success("Subject removed", taxonomyService.deleteSubject(id)));
    }
}

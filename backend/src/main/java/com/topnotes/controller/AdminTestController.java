package com.topnotes.controller;

import com.topnotes.dto.request.TestConfigRequest;
import com.topnotes.dto.request.TestQuestionRequest;
import com.topnotes.dto.response.ApiResponse;
import com.topnotes.dto.response.TestConfigResponse;
import com.topnotes.dto.response.TestOverviewResponse;
import com.topnotes.dto.response.TestQuestionAdminResponse;
import com.topnotes.service.TestManagementService;
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
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Admin endpoints for managing the configurable verification test.
 *
 * Base path: /admin/test
 *
 * ─── Config ──────────────────────────────────────────────────────────
 *  GET    /admin/test/config          → Get current test configuration
 *  PUT    /admin/test/config          → Update test config
 *
 * ─── Questions ───────────────────────────────────────────────────────
 *  GET    /admin/test/questions       → Paginated list (with search)
 *  GET    /admin/test/questions/{id}  → Single question detail
 *  POST   /admin/test/questions       → Create new question
 *  PUT    /admin/test/questions/{id}  → Update question + options
 *  DELETE /admin/test/questions/{id}  → Delete question
 *  PATCH  /admin/test/questions/{id}/toggle  → Enable/disable
 *  PUT    /admin/test/questions/reorder      → Bulk reorder
 */
@RestController
@RequestMapping("/admin/test")
@PreAuthorize("hasRole('ADMIN')")
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Admin — Test Management",
     description = "Configure the seller verification test: questions, options, pass score, time limit, shuffle")
public class AdminTestController {

    private final TestManagementService testManagementService;

    public AdminTestController(TestManagementService testManagementService) {
        this.testManagementService = testManagementService;
    }

    // ══════════════════════════════════════════════════════════
    // TEST CONFIG
    // ══════════════════════════════════════════════════════════

    @GetMapping("/overview")
    @Operation(summary = "Per-category test health matrix (General + each category)")
    public ResponseEntity<ApiResponse<List<TestOverviewResponse>>> getOverview() {
        return ResponseEntity.ok(ApiResponse.success(testManagementService.getOverview()));
    }

    @GetMapping("/config")
    @Operation(summary = "Get a category's test config (omit categoryId for the global Default)")
    public ResponseEntity<ApiResponse<TestConfigResponse>> getConfig(
            @RequestParam(required = false) Long categoryId) {
        return ResponseEntity.ok(ApiResponse.success(testManagementService.getConfig(categoryId)));
    }

    @PutMapping("/config")
    @Operation(summary = "Update a category's test config (omit categoryId for the global Default)")
    public ResponseEntity<ApiResponse<TestConfigResponse>> updateConfig(
            @RequestParam(required = false) Long categoryId,
            @Valid @RequestBody TestConfigRequest request) {

        TestConfigResponse updated = testManagementService.updateConfig(categoryId, request);
        return ResponseEntity.ok(ApiResponse.success("Test configuration updated successfully", updated));
    }

    // ══════════════════════════════════════════════════════════
    // QUESTIONS — LIST & SEARCH
    // ══════════════════════════════════════════════════════════

    @GetMapping("/questions")
    @Operation(summary = "Questions in a category's pool (omit categoryId for the General/shared pool). ?keyword= to search.")
    public ResponseEntity<ApiResponse<Page<TestQuestionAdminResponse>>> getQuestions(
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "20") int size) {

        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.ASC, "displayOrder"));
        return ResponseEntity.ok(ApiResponse.success(
                testManagementService.getQuestions(categoryId, keyword, pageable)));
    }

    @GetMapping("/questions/{id}")
    @Operation(summary = "Get a single question with all options and correct answer")
    public ResponseEntity<ApiResponse<TestQuestionAdminResponse>> getQuestion(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(testManagementService.getQuestionById(id)));
    }

    // ══════════════════════════════════════════════════════════
    // QUESTIONS — CREATE / UPDATE / DELETE
    // ══════════════════════════════════════════════════════════

    @PostMapping("/questions")
    @Operation(summary = "Create a new MCQ question with options. Set correctAnswerKey to the correct option's key.")
    public ResponseEntity<ApiResponse<TestQuestionAdminResponse>> createQuestion(
            @Valid @RequestBody TestQuestionRequest request) {

        TestQuestionAdminResponse created = testManagementService.createQuestion(request);
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.success("Question created successfully", created));
    }

    @PutMapping("/questions/{id}")
    @Operation(summary = "Update a question — replaces all options. correctAnswerKey must match an option key.")
    public ResponseEntity<ApiResponse<TestQuestionAdminResponse>> updateQuestion(
            @PathVariable Long id,
            @Valid @RequestBody TestQuestionRequest request) {

        TestQuestionAdminResponse updated = testManagementService.updateQuestion(id, request);
        return ResponseEntity.ok(ApiResponse.success("Question updated successfully", updated));
    }

    @DeleteMapping("/questions/{id}")
    @Operation(summary = "Permanently delete a question and all its options")
    public ResponseEntity<ApiResponse<Void>> deleteQuestion(@PathVariable Long id) {
        testManagementService.deleteQuestion(id);
        return ResponseEntity.ok(ApiResponse.success("Question deleted successfully"));
    }

    // ══════════════════════════════════════════════════════════
    // QUESTIONS — TOGGLE & REORDER
    // ══════════════════════════════════════════════════════════

    @PatchMapping("/questions/{id}/toggle")
    @Operation(summary = "Enable or disable a question. Disabled questions are excluded from tests.")
    public ResponseEntity<ApiResponse<TestQuestionAdminResponse>> toggleQuestion(
            @PathVariable Long id,
            @RequestParam boolean isActive) {

        TestQuestionAdminResponse result = testManagementService.toggleActive(id, isActive);
        String msg = isActive ? "Question enabled" : "Question disabled";
        return ResponseEntity.ok(ApiResponse.success(msg, result));
    }

    @PutMapping("/questions/reorder")
    @Operation(summary = "Reorder questions — send list of question IDs in desired order")
    public ResponseEntity<ApiResponse<Void>> reorderQuestions(
            @RequestBody List<Long> orderedIds) {

        testManagementService.reorderQuestions(orderedIds);
        return ResponseEntity.ok(ApiResponse.success("Questions reordered successfully"));
    }
}

package com.topnotes.controller;

import com.topnotes.dto.request.ConfigUpdateRequest;
import com.topnotes.dto.response.*;
import com.topnotes.entity.enums.UserRole;
import com.topnotes.entity.enums.UserStatus;
import com.topnotes.security.CustomUserDetails;
import com.topnotes.service.AdminService;
import com.topnotes.service.DashboardService;
import com.topnotes.service.SellerVerificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Admin-only operations:
 *   - Platform dashboard
 *   - User management (list, suspend, activate)
 *   - Seller verification approval
 *   - Platform configuration
 *   - All-notes view
 */
@RestController
@RequestMapping("/admin")
@PreAuthorize("hasRole('ADMIN')")
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Admin", description = "Admin platform management operations")
public class AdminController {

    private final AdminService              adminService;
    private final DashboardService          dashboardService;
    private final SellerVerificationService verificationService;

    public AdminController(AdminService adminService,
                           DashboardService dashboardService,
                           SellerVerificationService verificationService) {
        this.adminService        = adminService;
        this.dashboardService    = dashboardService;
        this.verificationService = verificationService;
    }

    // ── Dashboard ─────────────────────────────────────────────

    @GetMapping("/dashboard")
    @Operation(summary = "Admin platform analytics dashboard")
    public ResponseEntity<ApiResponse<DashboardResponse>> getDashboard() {
        return ResponseEntity.ok(ApiResponse.success(dashboardService.getAdminDashboard()));
    }

    // ── User management ───────────────────────────────────────

    @GetMapping("/users")
    @Operation(summary = "Get paginated list of all users with optional role filter")
    public ResponseEntity<ApiResponse<Page<UserResponse>>> getUsers(
            @RequestParam(required = false) UserRole   role,
            @RequestParam(required = false) UserStatus status,
            @RequestParam(required = false) String     keyword,
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "20") int size) {

        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        return ResponseEntity.ok(ApiResponse.success(adminService.getUsers(role, status, keyword, pageable)));
    }

    @GetMapping("/users/{id}")
    @Operation(summary = "Get full profile of a single user by ID")
    public ResponseEntity<ApiResponse<UserResponse>> getUserById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(adminService.getUserById(id)));
    }

    @PutMapping("/users/{id}/suspend")
    @Operation(summary = "Suspend a user account")
    public ResponseEntity<ApiResponse<UserResponse>> suspendUser(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success("User suspended", adminService.suspendUser(id)));
    }

    @PutMapping("/users/{id}/activate")
    @Operation(summary = "Reactivate a suspended user account")
    public ResponseEntity<ApiResponse<UserResponse>> activateUser(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success("User activated", adminService.activateUser(id)));
    }

    // ── Seller verifications ──────────────────────────────────

    @GetMapping("/verifications/pending")
    @Operation(summary = "Get paginated list of sellers awaiting marksheet approval")
    public ResponseEntity<ApiResponse<Page<UserResponse>>> getPendingVerifications(
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "10") int size) {

        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.ASC, "createdAt"));
        return ResponseEntity.ok(ApiResponse.success(adminService.getPendingVerifications(pageable)));
    }

    @PostMapping("/verifications/{sellerId}/approve")
    @Operation(summary = "Approve or reject a seller's marksheet — set approved=true/false")
    public ResponseEntity<ApiResponse<UserResponse>> approveSeller(
            @PathVariable Long    sellerId,
            @RequestParam         boolean approved,
            @RequestParam(required = false) String reason) {

        UserResponse result = verificationService.adminApproveOrReject(sellerId, approved, reason);
        String msg = approved ? "Seller approved successfully" : "Seller rejected";
        return ResponseEntity.ok(ApiResponse.success(msg, result));
    }

    // ── Platform configuration ────────────────────────────────

    @GetMapping("/config")
    @Operation(summary = "Get all platform configuration key-value pairs")
    public ResponseEntity<ApiResponse<Map<String, String>>> getAllConfig() {
        return ResponseEntity.ok(ApiResponse.success(adminService.getAllConfig()));
    }

    @PutMapping("/config")
    @Operation(summary = "Update a platform configuration value (e.g. commission percentage)")
    public ResponseEntity<ApiResponse<Void>> updateConfig(
            @Valid @RequestBody ConfigUpdateRequest request) {

        adminService.updateConfig(request);
        return ResponseEntity.ok(ApiResponse.success("Configuration updated successfully"));
    }

    // ── Notes ─────────────────────────────────────────────────

    @GetMapping("/notes")
    @Operation(summary = "Get all active notes on the platform (admin view)")
    public ResponseEntity<ApiResponse<Page<NoteResponse>>> getAllNotes(
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "20") int size) {

        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        return ResponseEntity.ok(ApiResponse.success(adminService.getAllNotes(pageable)));
    }
}

package com.topnotes.controller;

import com.topnotes.dto.response.ApiResponse;
import com.topnotes.dto.response.AuthResponse;
import com.topnotes.security.CustomUserDetails;
import com.topnotes.service.AuthService;
import com.topnotes.util.FileUploadUtil;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.bind.annotation.RequestParam;

import java.io.IOException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Self-service account actions for the logged-in user.
 *
 * Currently exposes the "become a seller" upgrade, which lets a buyer opt into
 * selling. The account keeps its buying ability; selling still requires the
 * existing verification flow before any note can be published.
 */
@RestController
@RequestMapping("/profile")
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Profile", description = "Self-service account operations")
public class ProfileController {

    private final AuthService authService;
    private final FileUploadUtil fileUploadUtil;

    public ProfileController(AuthService authService, FileUploadUtil fileUploadUtil) {
        this.authService = authService;
        this.fileUploadUtil = fileUploadUtil;
    }

    @PostMapping("/become-seller")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Upgrade the current account to a SELLER and re-issue the JWT")
    public ResponseEntity<ApiResponse<AuthResponse>> becomeSeller(
            @AuthenticationPrincipal CustomUserDetails principal) {

        AuthResponse response = authService.becomeSeller(principal.getId());
        return ResponseEntity.ok(ApiResponse.success("You can now start selling", response));
    }

    @PostMapping("/refresh-token")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Re-issue the JWT with the current account state (role, verification)")
    public ResponseEntity<ApiResponse<AuthResponse>> refreshToken(
            @AuthenticationPrincipal CustomUserDetails principal) {

        AuthResponse response = authService.refreshToken(principal.getId());
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/upi")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Get the current seller payout UPI")
    public ResponseEntity<ApiResponse<String>> getUpi(
            @AuthenticationPrincipal CustomUserDetails principal) {

        // 2-arg form so the UPI lands in `data` (success(String) would put it in `message`).
        return ResponseEntity.ok(ApiResponse.success("Payout UPI", authService.getUpiId(principal.getId())));
    }

    @PutMapping("/upi")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Set/update the seller payout UPI (for earnings payout)")
    public ResponseEntity<ApiResponse<Void>> updateUpi(
            @AuthenticationPrincipal CustomUserDetails principal,
            @RequestBody Map<String, String> body) {

        authService.updateUpiId(principal.getId(), body.get("upiId"));
        return ResponseEntity.ok(ApiResponse.success("Payout UPI saved"));
    }

    @PutMapping("/password")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Change the current account's password (verifies the current one)")
    public ResponseEntity<ApiResponse<Void>> changePassword(
            @AuthenticationPrincipal CustomUserDetails principal,
            @RequestBody Map<String, String> body) {

        authService.changePassword(principal.getId(), body.get("currentPassword"), body.get("newPassword"));
        return ResponseEntity.ok(ApiResponse.success("Password updated"));
    }

    @PutMapping
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Update the current account's display name and phone")
    public ResponseEntity<ApiResponse<AuthResponse>> updateProfile(
            @AuthenticationPrincipal CustomUserDetails principal,
            @RequestBody Map<String, String> body) {

        AuthResponse res = authService.updateProfile(principal.getId(), body.get("fullName"), body.get("phone"));
        return ResponseEntity.ok(ApiResponse.success("Profile updated", res));
    }

    @PostMapping("/image")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Upload the current account's profile picture (stored on Cloudinary)")
    public ResponseEntity<ApiResponse<AuthResponse>> uploadProfileImage(
            @AuthenticationPrincipal CustomUserDetails principal,
            @RequestParam("file") MultipartFile file) throws IOException {

        String url = fileUploadUtil.storeProfileImage(file);
        AuthResponse res = authService.setProfileImage(principal.getId(), url);
        return ResponseEntity.ok(ApiResponse.success("Profile picture updated", res));
    }

    @DeleteMapping("/image")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Remove the current account's profile picture (revert to initials)")
    public ResponseEntity<ApiResponse<AuthResponse>> removeProfileImage(
            @AuthenticationPrincipal CustomUserDetails principal) {

        AuthResponse res = authService.setProfileImage(principal.getId(), null);
        return ResponseEntity.ok(ApiResponse.success("Profile picture removed", res));
    }
}

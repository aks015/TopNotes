package com.topnotes.controller;

import com.topnotes.dto.request.VerifyEmailRequest;
import com.topnotes.dto.response.ApiResponse;
import com.topnotes.dto.response.AuthResponse;
import com.topnotes.security.CustomUserDetails;
import com.topnotes.service.EmailVerificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Email-confirmation OTP for the signed-in user. Lives under /auth/email/** but,
 * unlike the rest of /auth, requires authentication — the code is always tied to
 * the principal, so there's no email enumeration or open OTP-spam surface.
 */
@RestController
@RequestMapping("/auth/email")
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Email Verification", description = "Confirm control of the account email via OTP")
public class EmailVerificationController {

    private final EmailVerificationService emailVerificationService;

    public EmailVerificationController(EmailVerificationService emailVerificationService) {
        this.emailVerificationService = emailVerificationService;
    }

    @PostMapping("/send")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Send (or resend) a 6-digit verification code to the signed-in user's email")
    public ResponseEntity<ApiResponse<Void>> send(@AuthenticationPrincipal CustomUserDetails principal) {
        emailVerificationService.sendCode(principal.getId());
        return ResponseEntity.ok(ApiResponse.success("Verification code sent to your email"));
    }

    @PostMapping("/verify")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Verify the 6-digit code; returns a refreshed session on success")
    public ResponseEntity<ApiResponse<AuthResponse>> verify(
            @AuthenticationPrincipal CustomUserDetails principal,
            @Valid @RequestBody VerifyEmailRequest request) {

        AuthResponse res = emailVerificationService.verifyCode(principal.getId(), request.getCode());
        return ResponseEntity.ok(ApiResponse.success("Email verified", res));
    }
}

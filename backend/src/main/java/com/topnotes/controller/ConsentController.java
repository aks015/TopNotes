package com.topnotes.controller;

import com.topnotes.dto.request.ConsentRequest;
import com.topnotes.dto.response.AgreementResponse;
import com.topnotes.dto.response.ApiResponse;
import com.topnotes.entity.enums.AgreementType;
import com.topnotes.security.CustomUserDetails;
import com.topnotes.service.ConsentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * Serves versioned agreement text and records the signed-in user's consent with a
 * legally-defensible audit trail (version, exact-text hash, IP, user-agent).
 */
@RestController
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Consent", description = "Agreement text and consent recording")
public class ConsentController {

    private final ConsentService consentService;

    public ConsentController(ConsentService consentService) {
        this.consentService = consentService;
    }

    @GetMapping("/agreements/{type}")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Get the active agreement text + whether the current user has accepted it")
    public ResponseEntity<ApiResponse<AgreementResponse>> getAgreement(
            @PathVariable AgreementType type,
            @AuthenticationPrincipal CustomUserDetails principal) {

        return ResponseEntity.ok(ApiResponse.success(consentService.getAgreement(type, principal.getId())));
    }

    @PostMapping("/consent")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Record the current user's acceptance of an agreement (captures IP & user-agent)")
    public ResponseEntity<ApiResponse<Void>> recordConsent(
            @Valid @RequestBody ConsentRequest body,
            @AuthenticationPrincipal CustomUserDetails principal,
            HttpServletRequest request) {

        consentService.recordConsent(principal.getId(), body.getType(), body.getNoteId(),
                clientIp(request), request.getHeader("User-Agent"));
        return ResponseEntity.ok(ApiResponse.success("Consent recorded"));
    }

    /** Real client IP, honouring the proxy (Render) X-Forwarded-For header. */
    private static String clientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}

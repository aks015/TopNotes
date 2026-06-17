package com.topnotes.controller;

import com.topnotes.dto.response.ApiResponse;
import com.topnotes.dto.response.NoteResponse;
import com.topnotes.dto.response.SellerProfileResponse;
import com.topnotes.security.CustomUserDetails;
import com.topnotes.service.SellerProfileService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Public, read-only seller profile — the buyer-facing "/u/{id}" page that shows
 * who a topper is and their subject-wise catalogue. No auth required; a logged-in
 * viewer additionally gets the isPurchased flag on each note.
 */
@RestController
@RequestMapping("/sellers")
@Tag(name = "Seller profile", description = "Public seller profiles")
public class SellerProfileController {

    private final SellerProfileService sellerProfileService;

    public SellerProfileController(SellerProfileService sellerProfileService) {
        this.sellerProfileService = sellerProfileService;
    }

    @GetMapping("/{id}")
    @Operation(summary = "Public seller profile — identity, live stats and coverage")
    public ResponseEntity<ApiResponse<SellerProfileResponse>> getProfile(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(sellerProfileService.getProfile(id)));
    }

    @GetMapping("/{id}/notes")
    @Operation(summary = "A seller's published notes (ordered subject→newest)")
    public ResponseEntity<ApiResponse<List<NoteResponse>>> getNotes(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails principal) {
        Long viewerId = principal != null ? principal.getId() : null;
        return ResponseEntity.ok(ApiResponse.success(sellerProfileService.getActiveNotes(id, viewerId)));
    }
}

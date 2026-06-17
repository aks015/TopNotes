package com.topnotes.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.topnotes.dto.response.ApiResponse;
import com.topnotes.service.ContentService;
import com.topnotes.util.FileUploadUtil;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

/**
 * Admin-editable site content (landing page CMS).
 * Public read so the landing page renders for guests; admin-only write.
 */
@RestController
@Tag(name = "Content", description = "Admin-editable landing page content")
public class ContentController {

    private final ContentService contentService;
    private final FileUploadUtil fileUploadUtil;

    public ContentController(ContentService contentService, FileUploadUtil fileUploadUtil) {
        this.contentService = contentService;
        this.fileUploadUtil = fileUploadUtil;
    }

    @GetMapping("/content/landing")
    @Operation(summary = "Public — landing page content")
    public ResponseEntity<ApiResponse<JsonNode>> getLanding() {
        return ResponseEntity.ok(ApiResponse.success(contentService.getLanding()));
    }

    @PutMapping("/admin/content/landing")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Admin — update landing page content")
    public ResponseEntity<ApiResponse<JsonNode>> updateLanding(@RequestBody JsonNode body) {
        return ResponseEntity.ok(ApiResponse.success("Landing content saved", contentService.updateLanding(body)));
    }

    @PostMapping("/admin/content/image")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Admin — upload an image (e.g. founder photo); returns its URL")
    public ResponseEntity<ApiResponse<String>> uploadImage(@RequestParam("file") MultipartFile file)
            throws IOException {
        String url = fileUploadUtil.storeProfileImage(file);
        return ResponseEntity.ok(ApiResponse.success("Image uploaded", url));
    }
}

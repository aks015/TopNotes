package com.topnotes.dto.response;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Admin-only view of a note awaiting content review. Unlike the public
 * {@link NoteResponse}, this intentionally exposes {@code pdfUrl} so the admin
 * can open the full document and verify it's the seller's own original work.
 */
public record PendingNoteResponse(
        Long id,
        String title,
        String description,
        String category,
        String exam,
        String subject,
        String level,
        BigDecimal price,
        String thumbnailUrl,
        String pdfUrl,
        Integer totalPages,
        Long sellerId,
        String sellerName,
        String sellerEmail,
        LocalDateTime createdAt,
        // ── Decision-support for the reviewer ──
        boolean originalityDeclared,
        LocalDateTime originalityDeclaredAt,
        long sellerApprovedCount,
        long sellerRejectedCount,
        String sellerQualifiedCategory) {
}

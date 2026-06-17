package com.topnotes.dto.response;

import java.time.LocalDateTime;

/** A pending (or processed) qualification for the admin verification queue. */
public record QualificationReviewResponse(
        Long          id,
        Long          sellerId,
        String        sellerName,
        String        email,
        String        institution,
        Long          categoryId,
        String        categoryName,
        int           bestScore,
        String        status,
        String        marksheetUrl,
        LocalDateTime submittedAt
) {}

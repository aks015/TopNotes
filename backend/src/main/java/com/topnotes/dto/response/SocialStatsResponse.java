package com.topnotes.dto.response;

import java.math.BigDecimal;

/**
 * Real, computed social-proof numbers for the public landing page.
 * Everything here is derived from live data — never hardcoded marketing copy.
 */
public record SocialStatsResponse(
        BigDecimal averageRating,  // review-weighted average across all reviews (0 when none)
        long reviewCount,          // total reviews on the platform
        long learners,             // distinct buyers who completed a purchase
        long notesCount,           // active note listings
        long sellers,              // all sellers
        long verifiedSellers,      // verified toppers (can publish)
        long sales                 // completed purchases
) {}

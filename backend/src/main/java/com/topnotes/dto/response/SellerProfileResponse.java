package com.topnotes.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Full public seller profile (the "/u/{id}" page): identity + live aggregate
 * stats + the domains/subjects they cover. All fields are computed from real
 * data — nothing is stored denormalised on the user.
 */
@Getter
@Builder
public class SellerProfileResponse {
    private Long          id;
    private String        fullName;
    private String        profileImageUrl;
    private Boolean       verified;
    private String        institution;
    private String        classLevel;
    private String        bio;
    private LocalDateTime joinedAt;

    // Live aggregates
    private long          totalNotes;     // ACTIVE notes
    private long          totalSales;
    private long          learners;       // distinct buyers
    private BigDecimal    averageRating;  // review-weighted
    private long          reviewCount;

    // Coverage (derived from live notes)
    private List<String>  domains;        // exam categories, e.g. ["Engineering", "Medical"]
    private List<String>  exams;          // distinct exams, e.g. ["NEET UG"]
    private List<String>  subjects;       // distinct subjects taught
}

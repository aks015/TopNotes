package com.topnotes.dto.response;

import lombok.Builder;
import lombok.Getter;

/** Public seller profile shown on note listing cards — hides private details. */
@Getter
@Builder
public class SellerPublicProfile {
    private Long   id;
    private String fullName;
    private String classLevel;
    private String institution;
    private String bio;
    private String profileImageUrl;
    private Boolean verified;
    private Long   totalNotes;
    private Long   totalSales;
}

package com.topnotes.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.util.Map;

/** Aggregate review stats for a note — computed from real review rows. */
@Getter
@Builder
public class ReviewStatsResponse {
    private BigDecimal average;
    private long total;
    /** Star (1–5) → number of reviews with that rating. */
    private Map<Integer, Long> counts;
}

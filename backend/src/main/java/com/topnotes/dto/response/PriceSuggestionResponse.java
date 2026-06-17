package com.topnotes.dto.response;

import java.math.BigDecimal;

/** Suggested price (median of comparable active notes) and how many notes it was based on. */
public record PriceSuggestionResponse(BigDecimal price, int sampleSize) {}

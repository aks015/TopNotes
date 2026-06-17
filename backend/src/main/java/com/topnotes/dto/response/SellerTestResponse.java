package com.topnotes.dto.response;

import java.util.List;

/** A served test for a seller to take in a specific category (answers stripped). */
public record SellerTestResponse(
        Long   categoryId,
        String categoryName,
        int    passScore,
        int    timeLimitMinutes,
        List<TestQuestionSellerResponse> questions
) {}

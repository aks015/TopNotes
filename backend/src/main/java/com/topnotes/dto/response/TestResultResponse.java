package com.topnotes.dto.response;

/** Result of submitting a category test. */
public record TestResultResponse(
        int     score,
        boolean passed,
        int     correct,
        int     total,
        String  status,   // resulting QualificationStatus
        String  message
) {}

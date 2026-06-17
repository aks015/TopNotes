package com.topnotes.entity.enums;

/**
 * Lifecycle of a seller's qualification to sell in a specific exam category.
 * Absence of a row = the seller hasn't started qualifying in that category.
 */
public enum QualificationStatus {
    /** Last attempt failed the test; the seller can retake if attempts remain. */
    TEST_FAILED,
    /** Passed the test; must upload a marksheet to proceed. */
    AWAITING_MARKSHEET,
    /** Marksheet uploaded; awaiting admin review. */
    PENDING_REVIEW,
    /** Admin approved — the seller can sell notes in this category. */
    APPROVED,
    /** Admin rejected — the seller may re-upload a marksheet or retake. */
    REJECTED
}

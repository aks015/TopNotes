package com.topnotes.dto.response;

/**
 * A seller's qualification state for one exam category (drives the seller's
 * "Qualifications" page). status is null when they haven't started.
 */
public record QualificationResponse(
        Long    categoryId,
        String  categoryName,
        String  status,            // null = NOT_STARTED, else QualificationStatus name
        int     bestScore,
        int     attemptsUsed,
        Integer attemptsLeft,      // null = unlimited
        boolean testAvailable,     // category has an active test + a non-empty question pool
        int     poolSize,          // active questions available (own + shared General)
        int     passScore,
        int     timeLimitMinutes,
        String  marksheetUrl,
        String  rejectionReason
) {}

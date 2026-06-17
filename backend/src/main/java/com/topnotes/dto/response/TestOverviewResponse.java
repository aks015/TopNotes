package com.topnotes.dto.response;

/**
 * One row of the admin Test Manager overview matrix — a category's (or the
 * shared "General" pool's) test health at a glance.
 */
public record TestOverviewResponse(
        Long    categoryId,        // null = General (shared) pool
        String  categoryName,
        boolean configActive,
        int     passScore,
        int     questionsPerTest,
        int     ownQuestions,      // questions in this scope's own pool
        int     activeQuestions,   // effective active pool (own + shared General for a real category)
        long    attempts,          // total attempts taken for this category
        int     passRate           // % of attempts that passed (0 when none)
) {}

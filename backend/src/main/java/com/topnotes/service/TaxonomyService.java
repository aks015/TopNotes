package com.topnotes.service;

import com.topnotes.dto.request.TaxonomyNameRequest;
import com.topnotes.dto.response.TaxonomyResponse;

public interface TaxonomyService {

    /** Active-only nested taxonomy for public dropdowns (upload / browse). */
    TaxonomyResponse getPublicTaxonomy();

    /** Full nested taxonomy including disabled entries — for the admin manager. */
    TaxonomyResponse getFullTaxonomy();

    // ── Category ──────────────────────────────────────────────
    TaxonomyResponse createCategory(TaxonomyNameRequest req);
    TaxonomyResponse updateCategory(Long id, TaxonomyNameRequest req);
    TaxonomyResponse deleteCategory(Long id);

    // ── Exam ──────────────────────────────────────────────────
    TaxonomyResponse createExam(Long categoryId, TaxonomyNameRequest req);
    TaxonomyResponse updateExam(Long id, TaxonomyNameRequest req);
    TaxonomyResponse deleteExam(Long id);

    // ── Subject ───────────────────────────────────────────────
    TaxonomyResponse createSubject(Long examId, TaxonomyNameRequest req);
    TaxonomyResponse updateSubject(Long id, TaxonomyNameRequest req);
    TaxonomyResponse deleteSubject(Long id);
}

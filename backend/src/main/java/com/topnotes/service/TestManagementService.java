package com.topnotes.service;

import com.topnotes.dto.request.TestConfigRequest;
import com.topnotes.dto.request.TestQuestionRequest;
import com.topnotes.dto.response.TestConfigResponse;
import com.topnotes.dto.response.TestOverviewResponse;
import com.topnotes.dto.response.TestQuestionAdminResponse;
import com.topnotes.entity.TestConfig;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

/**
 * Admin-only service for managing per-category verification tests.
 * categoryId == null everywhere means the global "Default" config /
 * shared "General" question pool.
 */
public interface TestManagementService {

    // ── Overview ──────────────────────────────────────────────
    List<TestOverviewResponse> getOverview();

    // ── Config (per-category; null = Default) ─────────────────
    TestConfigResponse getConfig(Long categoryId);
    TestConfigResponse updateConfig(Long categoryId, TestConfigRequest request);

    /** Internal — the global Default config entity (used by legacy verification flow). */
    TestConfig getConfigEntity();

    // ── Questions (scoped by category; null = General pool) ───
    Page<TestQuestionAdminResponse> getQuestions(Long categoryId, String keyword, Pageable pageable);
    TestQuestionAdminResponse       getQuestionById(Long id);
    TestQuestionAdminResponse       createQuestion(TestQuestionRequest request);
    TestQuestionAdminResponse       updateQuestion(Long id, TestQuestionRequest request);
    void                            deleteQuestion(Long id);
    TestQuestionAdminResponse       toggleActive(Long id, boolean isActive);

    void reorderQuestions(List<Long> orderedIds);
}

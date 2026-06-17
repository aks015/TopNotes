package com.topnotes.service.impl;

import com.topnotes.dto.request.TestConfigRequest;
import com.topnotes.dto.request.TestQuestionRequest;
import com.topnotes.dto.response.TestConfigResponse;
import com.topnotes.dto.response.TestOverviewResponse;
import com.topnotes.dto.response.TestQuestionAdminResponse;
import com.topnotes.entity.ExamCategory;
import com.topnotes.entity.TestConfig;
import com.topnotes.entity.TestOption;
import com.topnotes.entity.TestQuestion;
import com.topnotes.exception.BadRequestException;
import com.topnotes.exception.ResourceNotFoundException;
import com.topnotes.repository.ExamCategoryRepository;
import com.topnotes.repository.TestConfigRepository;
import com.topnotes.repository.TestQuestionRepository;
import com.topnotes.repository.VerificationTestRepository;
import com.topnotes.service.TestManagementService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
@Slf4j
public class TestManagementServiceImpl implements TestManagementService {

    private final TestQuestionRepository     questionRepository;
    private final TestConfigRepository       configRepository;
    private final ExamCategoryRepository     categoryRepository;
    private final VerificationTestRepository attemptRepository;

    public TestManagementServiceImpl(TestQuestionRepository questionRepository,
                                     TestConfigRepository configRepository,
                                     ExamCategoryRepository categoryRepository,
                                     VerificationTestRepository attemptRepository) {
        this.questionRepository = questionRepository;
        this.configRepository   = configRepository;
        this.categoryRepository = categoryRepository;
        this.attemptRepository  = attemptRepository;
    }

    // ══════════════════════════════════════════════════════════
    // OVERVIEW
    // ══════════════════════════════════════════════════════════

    @Override
    @Transactional(readOnly = true)
    public List<TestOverviewResponse> getOverview() {
        List<TestOverviewResponse> rows = new ArrayList<>();
        TestConfig defaultCfg = getOrCreateDefaultConfig();

        // General (shared) pool row
        rows.add(new TestOverviewResponse(
                null, "General (shared)",
                Boolean.TRUE.equals(defaultCfg.getIsActive()),
                defaultCfg.getPassScorePercent(), defaultCfg.getQuestionsPerTest(),
                (int) questionRepository.countByCategoryIsNull(),
                (int) questionRepository.countByCategoryIsNullAndIsActiveTrue(),
                0L, 0));

        for (ExamCategory cat : categoryRepository.findAllByOrderByDisplayOrderAscNameAsc()) {
            if (!Boolean.TRUE.equals(cat.getActive())) continue;
            TestConfig cfg = configRepository.findByCategoryId(cat.getId()).orElse(defaultCfg);
            long attempts = attemptRepository.countByCategoryId(cat.getId());
            long passed   = attemptRepository.countByCategoryIdAndPassedTrue(cat.getId());
            int passRate  = attempts > 0 ? (int) Math.round(passed * 100.0 / attempts) : 0;
            rows.add(new TestOverviewResponse(
                    cat.getId(), cat.getName(),
                    Boolean.TRUE.equals(cfg.getIsActive()),
                    cfg.getPassScorePercent(), cfg.getQuestionsPerTest(),
                    (int) questionRepository.countByCategoryId(cat.getId()),
                    (int) questionRepository.countActiveForCategory(cat.getId()),
                    attempts, passRate));
        }
        return rows;
    }

    // ══════════════════════════════════════════════════════════
    // CONFIG
    // ══════════════════════════════════════════════════════════

    @Override
    @Transactional
    public TestConfigResponse getConfig(Long categoryId) {
        if (categoryId == null) {
            return toConfigResponse(getOrCreateDefaultConfig(), null, null);
        }
        ExamCategory cat = fetchCategory(categoryId);
        TestConfig cfg = configRepository.findByCategoryId(categoryId).orElse(null);
        if (cfg == null) {
            // No row yet — return the Default's values as a template (not persisted).
            TestConfig d = getOrCreateDefaultConfig();
            cfg = TestConfig.builder()
                    .passScorePercent(d.getPassScorePercent()).timeLimitMinutes(d.getTimeLimitMinutes())
                    .maxAttempts(d.getMaxAttempts()).questionsPerTest(d.getQuestionsPerTest())
                    .shuffleQuestions(d.getShuffleQuestions()).shuffleOptions(d.getShuffleOptions())
                    .isActive(d.getIsActive()).build();
        }
        return toConfigResponse(cfg, cat.getId(), cat.getName());
    }

    @Override
    @Transactional(readOnly = true)
    public TestConfig getConfigEntity() {
        return getOrCreateDefaultConfig();
    }

    @Override
    @Transactional
    public TestConfigResponse updateConfig(Long categoryId, TestConfigRequest request) {
        ExamCategory cat = null;
        TestConfig config;
        if (categoryId == null) {
            config = getOrCreateDefaultConfig();
        } else {
            cat = fetchCategory(categoryId);
            ExamCategory fcat = cat;
            config = configRepository.findByCategoryId(categoryId)
                    .orElseGet(() -> TestConfig.builder().category(fcat).build());
            config.setCategory(cat);
        }
        config.setPassScorePercent(request.getPassScorePercent());
        config.setTimeLimitMinutes(request.getTimeLimitMinutes());
        config.setMaxAttempts(request.getMaxAttempts());
        config.setQuestionsPerTest(request.getQuestionsPerTest());
        config.setShuffleQuestions(request.getShuffleQuestions());
        config.setShuffleOptions(request.getShuffleOptions());
        config.setIsActive(request.getIsActive());

        TestConfig saved = configRepository.save(config);
        log.info("Test config saved for {} (passScore={}%, perTest={})",
                cat != null ? cat.getName() : "Default", saved.getPassScorePercent(), saved.getQuestionsPerTest());
        return toConfigResponse(saved, cat != null ? cat.getId() : null, cat != null ? cat.getName() : null);
    }

    // ══════════════════════════════════════════════════════════
    // QUESTIONS — ADMIN CRUD
    // ══════════════════════════════════════════════════════════

    @Override
    @Transactional(readOnly = true)
    public Page<TestQuestionAdminResponse> getQuestions(Long categoryId, String keyword, Pageable pageable) {
        String kw = StringUtils.hasText(keyword) ? keyword.trim().toLowerCase(Locale.ROOT) : "";
        Page<TestQuestion> questions = (categoryId == null)
                ? questionRepository.adminSearchGeneral(kw, pageable)
                : questionRepository.adminSearchInCategory(categoryId, kw, pageable);
        return questions.map(this::toAdminResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public TestQuestionAdminResponse getQuestionById(Long id) {
        return toAdminResponse(fetchQuestion(id));
    }

    @Override
    @Transactional
    public TestQuestionAdminResponse createQuestion(TestQuestionRequest request) {
        validateOptions(request);

        // Auto-assign display order if not provided
        int order = (request.getDisplayOrder() != null)
                ? request.getDisplayOrder()
                : (int) questionRepository.count() + 1;

        TestQuestion question = TestQuestion.builder()
                .questionText(request.getQuestionText())
                .subject(request.getSubject())
                .category(request.getCategoryId() != null ? fetchCategory(request.getCategoryId()) : null)
                .displayOrder(order)
                .isActive(request.getIsActive() != null ? request.getIsActive() : true)
                .options(new ArrayList<>())
                .build();

        // Build options
        for (TestQuestionRequest.TestOptionRequest optReq : request.getOptions()) {
            TestOption option = TestOption.builder()
                    .question(question)
                    .optionKey(optReq.getOptionKey().toUpperCase())
                    .optionText(optReq.getOptionText())
                    .isCorrect(optReq.getOptionKey().equalsIgnoreCase(request.getCorrectAnswerKey()))
                    .build();
            question.getOptions().add(option);
        }

        TestQuestion saved = questionRepository.save(question);
        log.info("Test question id={} created with {} options, correctKey={}",
                saved.getId(), saved.getOptions().size(), request.getCorrectAnswerKey());
        return toAdminResponse(saved);
    }

    @Override
    @Transactional
    public TestQuestionAdminResponse updateQuestion(Long id, TestQuestionRequest request) {
        TestQuestion question = fetchQuestion(id);
        validateOptions(request);

        question.setQuestionText(request.getQuestionText());
        question.setSubject(request.getSubject());
        question.setCategory(request.getCategoryId() != null ? fetchCategory(request.getCategoryId()) : null);
        if (request.getDisplayOrder() != null) {
            question.setDisplayOrder(request.getDisplayOrder());
        }
        if (request.getIsActive() != null) {
            question.setIsActive(request.getIsActive());
        }

        // Replace all options (orphanRemoval handles deletions)
        question.getOptions().clear();
        for (TestQuestionRequest.TestOptionRequest optReq : request.getOptions()) {
            TestOption option = TestOption.builder()
                    .question(question)
                    .optionKey(optReq.getOptionKey().toUpperCase())
                    .optionText(optReq.getOptionText())
                    .isCorrect(optReq.getOptionKey().equalsIgnoreCase(request.getCorrectAnswerKey()))
                    .build();
            question.getOptions().add(option);
        }

        TestQuestion saved = questionRepository.save(question);
        log.info("Test question id={} updated", id);
        return toAdminResponse(saved);
    }

    @Override
    @Transactional
    public void deleteQuestion(Long id) {
        TestQuestion question = fetchQuestion(id);
        questionRepository.delete(question);
        log.info("Test question id={} deleted", id);
    }

    @Override
    @Transactional
    public TestQuestionAdminResponse toggleActive(Long id, boolean isActive) {
        TestQuestion question = fetchQuestion(id);
        question.setIsActive(isActive);
        TestQuestion saved = questionRepository.save(question);
        log.info("Test question id={} isActive set to {}", id, isActive);
        return toAdminResponse(saved);
    }

    @Override
    @Transactional
    public void reorderQuestions(List<Long> orderedIds) {
        if (orderedIds == null || orderedIds.isEmpty()) return;
        for (int i = 0; i < orderedIds.size(); i++) {
            TestQuestion q = fetchQuestion(orderedIds.get(i));
            q.setDisplayOrder(i + 1);
            questionRepository.save(q);
        }
        log.info("Reordered {} test questions", orderedIds.size());
    }

    // ══════════════════════════════════════════════════════════
    // PRIVATE HELPERS
    // ══════════════════════════════════════════════════════════

    private TestQuestion fetchQuestion(Long id) {
        return questionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Test question", id));
    }

    private TestConfig getOrCreateDefaultConfig() {
        return configRepository.findByCategoryIsNull()
                .or(configRepository::findFirstByOrderByIdAsc)
                .orElseGet(() -> {
                    log.info("No test config found — creating default config");
                    return configRepository.save(TestConfig.builder().build());
                });
    }

    private ExamCategory fetchCategory(Long id) {
        return categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Category", id));
    }

    private void validateOptions(TestQuestionRequest request) {
        if (request.getOptions() == null || request.getOptions().size() < 2) {
            throw new BadRequestException("A question must have at least 2 options");
        }
        // Ensure correctAnswerKey maps to an actual option
        boolean correctKeyExists = request.getOptions().stream()
                .anyMatch(o -> o.getOptionKey().equalsIgnoreCase(request.getCorrectAnswerKey()));
        if (!correctKeyExists) {
            throw new BadRequestException(
                    "Correct answer key '" + request.getCorrectAnswerKey()
                    + "' does not match any provided option key");
        }
        // Ensure no duplicate option keys
        long distinctKeys = request.getOptions().stream()
                .map(o -> o.getOptionKey().toUpperCase())
                .distinct().count();
        if (distinctKeys < request.getOptions().size()) {
            throw new BadRequestException("Duplicate option keys are not allowed");
        }
    }

    // ── DTO mappers ───────────────────────────────────────────

    private TestQuestionAdminResponse toAdminResponse(TestQuestion q) {
        // Find which option is correct
        String correctKey = q.getOptions().stream()
                .filter(TestOption::getIsCorrect)
                .map(TestOption::getOptionKey)
                .findFirst()
                .orElse(null);

        List<TestQuestionAdminResponse.TestOptionResponse> optionResponses = q.getOptions().stream()
                .map(o -> TestQuestionAdminResponse.TestOptionResponse.builder()
                        .id(o.getId())
                        .optionKey(o.getOptionKey())
                        .optionText(o.getOptionText())
                        .isCorrect(o.getIsCorrect())
                        .build())
                .toList();

        return TestQuestionAdminResponse.builder()
                .id(q.getId())
                .questionText(q.getQuestionText())
                .subject(q.getSubject())
                .displayOrder(q.getDisplayOrder())
                .isActive(q.getIsActive())
                .correctAnswerKey(correctKey)
                .options(optionResponses)
                .createdAt(q.getCreatedAt())
                .build();
    }

    private TestConfigResponse toConfigResponse(TestConfig c, Long categoryId, String categoryName) {
        long activeCount = (categoryId == null)
                ? questionRepository.countByCategoryIsNullAndIsActiveTrue()
                : questionRepository.countActiveForCategory(categoryId);
        return TestConfigResponse.builder()
                .id(c.getId())
                .categoryId(categoryId)
                .categoryName(categoryName)
                .passScorePercent(c.getPassScorePercent())
                .timeLimitMinutes(c.getTimeLimitMinutes())
                .maxAttempts(c.getMaxAttempts())
                .questionsPerTest(c.getQuestionsPerTest())
                .shuffleQuestions(c.getShuffleQuestions())
                .shuffleOptions(c.getShuffleOptions())
                .isActive(c.getIsActive())
                .totalActiveQuestions((int) activeCount)
                .updatedAt(c.getUpdatedAt())
                .build();
    }
}

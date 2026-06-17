package com.topnotes.service.impl;

import com.topnotes.dto.response.QualificationResponse;
import com.topnotes.dto.response.QualificationReviewResponse;
import com.topnotes.dto.response.SellerTestResponse;
import com.topnotes.dto.response.TestQuestionSellerResponse;
import com.topnotes.dto.response.TestResultResponse;
import com.topnotes.entity.*;
import com.topnotes.entity.enums.NotificationType;
import com.topnotes.entity.enums.QualificationStatus;
import com.topnotes.exception.BadRequestException;
import com.topnotes.exception.ResourceNotFoundException;
import com.topnotes.repository.*;
import com.topnotes.service.NotificationService;
import com.topnotes.service.SellerQualificationService;
import com.topnotes.util.FileUploadUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.*;

@Service
@Slf4j
public class SellerQualificationServiceImpl implements SellerQualificationService {

    private final UserRepository               userRepository;
    private final ExamCategoryRepository       categoryRepository;
    private final TestConfigRepository         configRepository;
    private final TestQuestionRepository       questionRepository;
    private final VerificationTestRepository   attemptRepository;
    private final SellerQualificationRepository qualRepository;
    private final NoteRepository               noteRepository;
    private final FileUploadUtil               fileUploadUtil;
    private final NotificationService          notificationService;

    public SellerQualificationServiceImpl(UserRepository userRepository,
                                          ExamCategoryRepository categoryRepository,
                                          TestConfigRepository configRepository,
                                          TestQuestionRepository questionRepository,
                                          VerificationTestRepository attemptRepository,
                                          SellerQualificationRepository qualRepository,
                                          NoteRepository noteRepository,
                                          FileUploadUtil fileUploadUtil,
                                          NotificationService notificationService) {
        this.userRepository      = userRepository;
        this.categoryRepository  = categoryRepository;
        this.configRepository    = configRepository;
        this.questionRepository  = questionRepository;
        this.attemptRepository   = attemptRepository;
        this.qualRepository      = qualRepository;
        this.noteRepository      = noteRepository;
        this.fileUploadUtil      = fileUploadUtil;
        this.notificationService = notificationService;
    }

    // ── Seller: overview ──────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public List<QualificationResponse> getMyQualifications(Long sellerId) {
        Map<Long, SellerQualification> mine = new HashMap<>();
        for (SellerQualification q : qualRepository.findBySellerId(sellerId)) {
            mine.put(q.getCategory().getId(), q);
        }
        List<QualificationResponse> out = new ArrayList<>();
        for (ExamCategory cat : categoryRepository.findAllByOrderByDisplayOrderAscNameAsc()) {
            if (!Boolean.TRUE.equals(cat.getActive())) continue;
            TestConfig cfg = resolveConfig(cat.getId());
            long pool = questionRepository.countActiveForCategory(cat.getId());
            boolean testAvailable = cfg != null && Boolean.TRUE.equals(cfg.getIsActive()) && pool >= 1;
            SellerQualification q = mine.get(cat.getId());
            Integer attemptsLeft = (cfg != null && cfg.getMaxAttempts() != null && cfg.getMaxAttempts() > 0)
                    ? Math.max(0, cfg.getMaxAttempts() - (q != null ? q.getAttemptsUsed() : 0))
                    : null;
            out.add(new QualificationResponse(
                    cat.getId(), cat.getName(),
                    q != null ? q.getStatus().name() : null,
                    q != null ? q.getBestScore() : 0,
                    q != null ? q.getAttemptsUsed() : 0,
                    attemptsLeft,
                    testAvailable,
                    (int) pool,
                    cfg != null ? cfg.getPassScorePercent() : 70,
                    cfg != null ? cfg.getTimeLimitMinutes() : 30,
                    q != null ? q.getMarksheetUrl() : null,
                    q != null ? q.getRejectionReason() : null));
        }
        return out;
    }

    // ── Seller: take test ─────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public SellerTestResponse startTest(Long sellerId, Long categoryId) {
        ExamCategory cat = fetchCategory(categoryId);
        TestConfig cfg = resolveConfig(categoryId);
        if (cfg == null || !Boolean.TRUE.equals(cfg.getIsActive())) {
            throw new BadRequestException("No active test is configured for " + cat.getName() + " yet.");
        }
        SellerQualification q = qualRepository.findBySellerIdAndCategoryId(sellerId, categoryId).orElse(null);
        if (q != null) {
            switch (q.getStatus()) {
                case APPROVED -> throw new BadRequestException("You're already qualified in " + cat.getName() + ".");
                case AWAITING_MARKSHEET -> throw new BadRequestException("You've passed — upload your marksheet to continue.");
                case PENDING_REVIEW -> throw new BadRequestException("Your marksheet is under review.");
                default -> { /* TEST_FAILED / REJECTED → may retake */ }
            }
            if (cfg.getMaxAttempts() != null && cfg.getMaxAttempts() > 0 && q.getAttemptsUsed() >= cfg.getMaxAttempts()) {
                throw new BadRequestException("You've reached the maximum attempts (" + cfg.getMaxAttempts() + ") for " + cat.getName() + ".");
            }
        }

        List<TestQuestion> pool = questionRepository.findActiveForCategory(categoryId);
        if (pool.isEmpty()) throw new BadRequestException("No questions are configured for " + cat.getName() + " yet.");

        if (Boolean.TRUE.equals(cfg.getShuffleQuestions())) {
            pool = new ArrayList<>(pool);
            Collections.shuffle(pool);
        }
        int limit = (cfg.getQuestionsPerTest() != null && cfg.getQuestionsPerTest() > 0 && cfg.getQuestionsPerTest() < pool.size())
                ? cfg.getQuestionsPerTest() : pool.size();
        List<TestQuestionSellerResponse> questions = pool.subList(0, limit).stream().map(question -> {
            List<TestOption> opts = new ArrayList<>(question.getOptions());
            if (Boolean.TRUE.equals(cfg.getShuffleOptions())) Collections.shuffle(opts);
            return TestQuestionSellerResponse.builder()
                    .id(question.getId())
                    .questionText(question.getQuestionText())
                    .subject(question.getSubject())
                    .options(opts.stream().map(o -> TestQuestionSellerResponse.OptionItem.builder()
                            .optionKey(o.getOptionKey()).optionText(o.getOptionText()).build()).toList())
                    .build();
        }).toList();

        return new SellerTestResponse(cat.getId(), cat.getName(), cfg.getPassScorePercent(), cfg.getTimeLimitMinutes(), questions);
    }

    // ── Seller: submit test ───────────────────────────────────

    @Override
    @Transactional
    public TestResultResponse submitTest(Long sellerId, Long categoryId, Map<Long, String> answers) {
        User seller = fetchSeller(sellerId);
        ExamCategory cat = fetchCategory(categoryId);
        TestConfig cfg = resolveConfig(categoryId);
        if (cfg == null || !Boolean.TRUE.equals(cfg.getIsActive())) {
            throw new BadRequestException("No active test is configured for " + cat.getName() + ".");
        }
        SellerQualification q = qualRepository.findBySellerIdAndCategoryId(sellerId, categoryId).orElse(null);
        if (q != null && (q.getStatus() == QualificationStatus.APPROVED
                || q.getStatus() == QualificationStatus.AWAITING_MARKSHEET
                || q.getStatus() == QualificationStatus.PENDING_REVIEW)) {
            throw new BadRequestException("You've already cleared the test for " + cat.getName() + ".");
        }

        List<TestQuestion> pool = questionRepository.findActiveForCategory(categoryId);
        if (pool.isEmpty()) throw new BadRequestException("No questions available to grade.");

        // Denominator = questions served (so unanswered count against the seller).
        int served = (cfg.getQuestionsPerTest() != null && cfg.getQuestionsPerTest() > 0)
                ? Math.min(cfg.getQuestionsPerTest(), pool.size()) : pool.size();
        Map<Long, String> correctKeys = new HashMap<>();
        for (TestQuestion question : pool) {
            question.getOptions().stream().filter(TestOption::getIsCorrect).findFirst()
                    .ifPresent(o -> correctKeys.put(question.getId(), o.getOptionKey()));
        }
        int correct = 0;
        for (Map.Entry<Long, String> e : answers.entrySet()) {
            String key = correctKeys.get(e.getKey());
            if (key != null && key.equalsIgnoreCase(e.getValue() == null ? "" : e.getValue().trim())) correct++;
        }
        int denom = Math.max(served, 1);
        int score = (correct * 100) / denom;
        boolean passed = score >= cfg.getPassScorePercent();

        // Log attempt
        attemptRepository.save(VerificationTest.builder()
                .seller(seller).category(cat)
                .score(score).totalQuestions(served).correctAnswers(correct)
                .passed(passed).answersJson(answers.toString()).build());

        // Upsert qualification
        if (q == null) {
            q = SellerQualification.builder().seller(seller).category(cat)
                    .status(QualificationStatus.TEST_FAILED).bestScore(0).attemptsUsed(0).build();
        }
        q.setAttemptsUsed(q.getAttemptsUsed() + 1);
        q.setBestScore(Math.max(q.getBestScore(), score));
        q.setLastAttemptAt(LocalDateTime.now());
        q.setStatus(passed ? QualificationStatus.AWAITING_MARKSHEET : QualificationStatus.TEST_FAILED);
        qualRepository.save(q);

        if (passed) {
            notificationService.createNotification(seller, "Test passed — " + cat.getName() + " 🎓",
                    "You scored " + score + "%. Upload your marksheet to finish qualifying for " + cat.getName() + ".",
                    NotificationType.VERIFICATION);
        }
        log.info("Seller {} {} test: {}% ({}/{}) passed={}", sellerId, cat.getName(), score, correct, served, passed);

        return new TestResultResponse(score, passed, correct, served, q.getStatus().name(),
                passed ? "Passed! Upload your marksheet to qualify for " + cat.getName() + "."
                       : "Scored " + score + "% — need " + cfg.getPassScorePercent() + "%. You can retake.");
    }

    // ── Seller: marksheet ─────────────────────────────────────

    @Override
    @Transactional
    public String uploadMarksheet(Long sellerId, Long categoryId, MultipartFile marksheet) {
        ExamCategory cat = fetchCategory(categoryId);
        SellerQualification q = qualRepository.findBySellerIdAndCategoryId(sellerId, categoryId)
                .orElseThrow(() -> new BadRequestException("Pass the " + cat.getName() + " test before uploading a marksheet."));
        if (q.getStatus() != QualificationStatus.AWAITING_MARKSHEET && q.getStatus() != QualificationStatus.REJECTED) {
            throw new BadRequestException("Marksheet upload isn't available at this stage.");
        }
        String url;
        try {
            url = fileUploadUtil.storeMarksheet(marksheet);
        } catch (IOException e) {
            throw new BadRequestException("Failed to upload marksheet: " + e.getMessage());
        }
        q.setMarksheetUrl(url);
        q.setRejectionReason(null);
        q.setStatus(QualificationStatus.PENDING_REVIEW);
        qualRepository.save(q);
        log.info("Marksheet uploaded for seller {} category {}", sellerId, cat.getName());
        return "Marksheet uploaded for " + cat.getName() + ". Awaiting admin review.";
    }

    // ── Admin ─────────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public Page<QualificationReviewResponse> getPendingReview(Pageable pageable) {
        return qualRepository.findByStatusOrderByUpdatedAtDesc(QualificationStatus.PENDING_REVIEW, pageable)
                .map(this::toReview);
    }

    @Override
    @Transactional
    public QualificationReviewResponse review(Long qualificationId, boolean approved, String reason) {
        SellerQualification q = qualRepository.findById(qualificationId)
                .orElseThrow(() -> new ResourceNotFoundException("Qualification", qualificationId));
        boolean wasApproved = q.getStatus() == QualificationStatus.APPROVED;
        q.setStatus(approved ? QualificationStatus.APPROVED : QualificationStatus.REJECTED);
        q.setRejectionReason(approved ? null : reason);
        q.setApprovedAt(approved ? LocalDateTime.now() : null);
        qualRepository.save(q);

        User seller = q.getSeller();
        if (approved) {
            if (!Boolean.TRUE.equals(seller.getIsVerified())) {
                seller.setIsVerified(true);  // derived: has at least one approved category
                userRepository.save(seller);
            }
        } else {
            // Revoke cascade: if this category was approved, hide the seller's notes in it.
            if (wasApproved) {
                int hidden = noteRepository.deactivateBySellerAndCategory(seller.getId(), q.getCategory().getName());
                log.info("Revoked {}'s {} qualification — hid {} notes", seller.getId(), q.getCategory().getName(), hidden);
            }
            // Keep isVerified accurate (false once no approved categories remain).
            if (qualRepository.findBySellerIdAndStatus(seller.getId(), QualificationStatus.APPROVED).isEmpty()
                    && Boolean.TRUE.equals(seller.getIsVerified())) {
                seller.setIsVerified(false);
                userRepository.save(seller);
            }
        }
        notificationService.createNotification(seller,
                approved ? q.getCategory().getName() + " approved 🎉" : "Verification update — " + q.getCategory().getName(),
                approved ? "You can now sell notes in " + q.getCategory().getName() + "."
                         : "Your " + q.getCategory().getName() + " qualification was not approved. Reason: " + (reason != null ? reason : "N/A"),
                NotificationType.VERIFICATION);
        log.info("Qualification {} ({} / {}) approved={}", qualificationId, seller.getId(), q.getCategory().getName(), approved);
        return toReview(q);
    }

    // ── Upload gating helpers (Phase 3) ───────────────────────

    @Override
    @Transactional(readOnly = true)
    public boolean isApprovedFor(Long sellerId, Long categoryId) {
        return qualRepository.existsBySellerIdAndCategoryIdAndStatus(sellerId, categoryId, QualificationStatus.APPROVED);
    }

    @Override
    @Transactional(readOnly = true)
    public List<String> approvedCategoryNames(Long sellerId) {
        return qualRepository.findBySellerIdAndStatus(sellerId, QualificationStatus.APPROVED)
                .stream().map(q -> q.getCategory().getName()).toList();
    }

    // ── Helpers ───────────────────────────────────────────────

    private TestConfig resolveConfig(Long categoryId) {
        return configRepository.findByCategoryId(categoryId)
                .orElseGet(() -> configRepository.findByCategoryIsNull().orElse(null));
    }
    private User fetchSeller(Long id) {
        return userRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Seller", id));
    }
    private ExamCategory fetchCategory(Long id) {
        return categoryRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Category", id));
    }
    private QualificationReviewResponse toReview(SellerQualification q) {
        User s = q.getSeller();
        return new QualificationReviewResponse(
                q.getId(), s.getId(), s.getFullName(), s.getEmail(), s.getInstitution(),
                q.getCategory().getId(), q.getCategory().getName(), q.getBestScore(),
                q.getStatus().name(), q.getMarksheetUrl(), q.getUpdatedAt());
    }
}

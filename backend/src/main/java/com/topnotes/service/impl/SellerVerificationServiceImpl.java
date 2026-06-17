package com.topnotes.service.impl;

import com.topnotes.dto.response.TestQuestionSellerResponse;
import com.topnotes.dto.response.UserResponse;
import com.topnotes.entity.TestConfig;
import com.topnotes.entity.TestOption;
import com.topnotes.entity.TestQuestion;
import com.topnotes.entity.User;
import com.topnotes.entity.VerificationTest;
import com.topnotes.entity.enums.NotificationType;
import com.topnotes.exception.BadRequestException;
import com.topnotes.exception.ResourceNotFoundException;
import com.topnotes.repository.TestQuestionRepository;
import com.topnotes.repository.UserRepository;
import com.topnotes.repository.VerificationTestRepository;
import com.topnotes.service.NotificationService;
import com.topnotes.service.SellerVerificationService;
import com.topnotes.service.TestManagementService;
import com.topnotes.util.FileUploadUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
public class SellerVerificationServiceImpl implements SellerVerificationService {

    private final UserRepository             userRepository;
    private final VerificationTestRepository testRepository;
    private final TestQuestionRepository     questionRepository;
    private final TestManagementService      testManagementService;
    private final FileUploadUtil             fileUploadUtil;
    private final NotificationService        notificationService;

    public SellerVerificationServiceImpl(UserRepository userRepository,
                                         VerificationTestRepository testRepository,
                                         TestQuestionRepository questionRepository,
                                         TestManagementService testManagementService,
                                         FileUploadUtil fileUploadUtil,
                                         NotificationService notificationService) {
        this.userRepository       = userRepository;
        this.testRepository       = testRepository;
        this.questionRepository   = questionRepository;
        this.testManagementService = testManagementService;
        this.fileUploadUtil       = fileUploadUtil;
        this.notificationService  = notificationService;
    }

    @Override
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getTestQuestions(Long sellerId) {
        User       seller = fetchSeller(sellerId);
        TestConfig config = testManagementService.getConfigEntity();

        if (seller.getTestPassed()) {
            throw new BadRequestException("You have already passed the verification test");
        }
        if (!config.getIsActive()) {
            throw new BadRequestException("The verification test is currently disabled by admin");
        }

        // Check max attempts
        if (config.getMaxAttempts() > 0) {
            long attempts = testRepository.countBySellerId(sellerId);
            if (attempts >= config.getMaxAttempts()) {
                throw new BadRequestException(
                        "You have reached the maximum number of test attempts (" + config.getMaxAttempts() + ")");
            }
        }

        // Fetch active questions from DB
        List<TestQuestion> allActive = questionRepository.findByIsActiveTrueOrderByDisplayOrderAsc();
        if (allActive.isEmpty()) {
            throw new BadRequestException("No test questions are configured yet. Please contact admin.");
        }

        // Optionally shuffle
        if (Boolean.TRUE.equals(config.getShuffleQuestions())) {
            allActive = new ArrayList<>(allActive);
            Collections.shuffle(allActive);
        }

        // Limit to questionsPerTest
        int limit = (config.getQuestionsPerTest() > 0 && config.getQuestionsPerTest() < allActive.size())
                ? config.getQuestionsPerTest()
                : allActive.size();
        List<TestQuestion> selected = allActive.subList(0, limit);

        // Convert to seller-facing response (strip correct answers)
        return selected.stream().map(q -> {
            List<TestOption> options = new ArrayList<>(q.getOptions());
            if (Boolean.TRUE.equals(config.getShuffleOptions())) {
                Collections.shuffle(options);
            }
            List<Map<String, String>> optionList = options.stream()
                    .map(o -> Map.of("optionKey", o.getOptionKey(), "optionText", o.getOptionText()))
                    .collect(Collectors.toList());

            Map<String, Object> qMap = new LinkedHashMap<>();
            qMap.put("id",           q.getId());
            qMap.put("questionText", q.getQuestionText());
            qMap.put("subject",      q.getSubject());
            qMap.put("options",      optionList);
            return qMap;
        }).collect(Collectors.toList());
    }

    @Override
    @Transactional
    public Map<String, Object> submitTest(Long sellerId, Map<Integer, String> answers) {
        User       seller = fetchSeller(sellerId);
        TestConfig config = testManagementService.getConfigEntity();

        if (seller.getTestPassed()) {
            throw new BadRequestException("You have already passed the verification test");
        }

        // Grade against DB questions
        List<TestQuestion> allActive = questionRepository.findByIsActiveTrueOrderByDisplayOrderAsc();
        if (allActive.isEmpty()) {
            throw new BadRequestException("No active questions available to grade.");
        }

        int correct = 0;
        int total   = 0;
        for (TestQuestion q : allActive) {
            int    qId       = q.getId().intValue();
            String submitted = answers.getOrDefault(qId, "").trim().toUpperCase();
            if (!submitted.isEmpty()) {
                total++;
                // Find the correct option key for this question
                String correctKey = q.getOptions().stream()
                        .filter(TestOption::getIsCorrect)
                        .map(TestOption::getOptionKey)
                        .findFirst()
                        .orElse("");
                if (correctKey.equalsIgnoreCase(submitted)) correct++;
            }
        }

        // Grade against questions actually answered (or total active)
        int denominator = Math.max(total, 1);
        int passScore   = config.getPassScorePercent();
        int score       = (correct * 100) / denominator;
        boolean passed  = score >= passScore;

        // Persist attempt
        VerificationTest attempt = VerificationTest.builder()
                .seller(seller)
                .score(score)
                .totalQuestions(total)
                .correctAnswers(correct)
                .passed(passed)
                .answersJson(answers.toString())
                .build();
        testRepository.save(attempt);

        if (passed) {
            seller.setTestPassed(true);
            seller.setTestScore(score);
            userRepository.save(seller);

            notificationService.createNotification(seller,
                    "Test Passed! 🎓",
                    "You scored " + score + "%. Please upload your marksheet to complete verification.",
                    NotificationType.VERIFICATION);
        }

        log.info("Seller id={} test: score={}% passed={} correct={}/{}", sellerId, score, passed, correct, total);
        return Map.of(
                "score",   score,
                "passed",  passed,
                "correct", correct,
                "total",   total,
                "message", passed
                        ? "Test passed! Please upload your marksheet."
                        : "Score too low (" + score + "%). Required: " + passScore + "%. You may retake the test."
        );
    }

    @Override
    @Transactional
    public String uploadMarksheet(Long sellerId, MultipartFile marksheet) {
        User seller = fetchSeller(sellerId);

        if (!seller.getTestPassed()) {
            throw new BadRequestException("Please pass the verification test before uploading your marksheet");
        }

        String url;
        try {
            url = fileUploadUtil.storeMarksheet(marksheet);
        } catch (IOException e) {
            throw new BadRequestException("Failed to upload marksheet: " + e.getMessage());
        }

        seller.setMarksheetUrl(url);
        userRepository.save(seller);

        log.info("Marksheet uploaded for seller id={}", sellerId);
        return "Marksheet uploaded successfully. Awaiting admin approval.";
    }

    @Override
    @Transactional
    public UserResponse adminApproveOrReject(Long sellerId, boolean approved, String reason) {
        User seller = fetchSeller(sellerId);

        if (!seller.getTestPassed()) {
            throw new BadRequestException("Seller has not passed the verification test yet");
        }
        if (seller.getMarksheetUrl() == null) {
            throw new BadRequestException("Seller has not uploaded a marksheet yet");
        }

        seller.setMarksheetApproved(approved);
        seller.setIsVerified(approved);
        userRepository.save(seller);

        String notifTitle   = approved ? "Account Approved! 🎉" : "Verification Update";
        String notifMessage = approved
                ? "Your seller account is now verified. Start uploading your notes!"
                : "Your verification was not approved. Reason: " + (reason != null ? reason : "N/A");

        notificationService.createNotification(seller, notifTitle, notifMessage, NotificationType.VERIFICATION);
        log.info("Seller id={} verification: approved={}", sellerId, approved);

        return toUserResponse(seller);
    }

    @Override public boolean hasPassedTest(Long sellerId)        { return fetchSeller(sellerId).getTestPassed(); }
    @Override public boolean hasUploadedMarksheet(Long sellerId) { return fetchSeller(sellerId).getMarksheetUrl() != null; }
    @Override public boolean isVerified(Long sellerId)           { return fetchSeller(sellerId).getIsVerified(); }

    // ── Private helpers ───────────────────────────────────────

    private User fetchSeller(Long sellerId) {
        return userRepository.findById(sellerId)
                .orElseThrow(() -> new ResourceNotFoundException("Seller", sellerId));
    }

    private UserResponse toUserResponse(User u) {
        return UserResponse.builder()
                .id(u.getId()).email(u.getEmail()).fullName(u.getFullName())
                .role(u.getRole()).status(u.getStatus())
                .isVerified(u.getIsVerified()).testPassed(u.getTestPassed())
                .testScore(u.getTestScore()).marksheetApproved(u.getMarksheetApproved())
                .marksheetUrl(u.getMarksheetUrl())
                .institution(u.getInstitution()).classLevel(u.getClassLevel()).bio(u.getBio())
                .phone(u.getPhone()).profileImageUrl(u.getProfileImageUrl())
                .createdAt(u.getCreatedAt()).build();
    }
}

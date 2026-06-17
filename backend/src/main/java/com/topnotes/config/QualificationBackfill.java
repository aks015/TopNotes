package com.topnotes.config;

import com.topnotes.entity.ExamCategory;
import com.topnotes.entity.SellerQualification;
import com.topnotes.entity.User;
import com.topnotes.entity.enums.QualificationStatus;
import com.topnotes.repository.ExamCategoryRepository;
import com.topnotes.repository.NoteRepository;
import com.topnotes.repository.SellerQualificationRepository;
import com.topnotes.repository.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * One-time grandfather migration (decision: "approve only categories they already
 * have notes in"). For every (seller, category) pair that has a live note but no
 * qualification row yet, create an APPROVED qualification — so existing sellers
 * keep selling exactly where they already do, without the old global over-access.
 * Idempotent: only fills gaps, safe on every boot.
 */
@Component
@Order(30)
@Slf4j
public class QualificationBackfill implements CommandLineRunner {

    private final NoteRepository                noteRepository;
    private final ExamCategoryRepository        categoryRepository;
    private final SellerQualificationRepository qualRepository;
    private final UserRepository                userRepository;

    public QualificationBackfill(NoteRepository noteRepository,
                                 ExamCategoryRepository categoryRepository,
                                 SellerQualificationRepository qualRepository,
                                 UserRepository userRepository) {
        this.noteRepository     = noteRepository;
        this.categoryRepository = categoryRepository;
        this.qualRepository     = qualRepository;
        this.userRepository     = userRepository;
    }

    @Override
    @Transactional
    public void run(String... args) {
        int created = 0;
        for (Object[] pair : noteRepository.findDistinctSellerCategoryPairs()) {
            Long   sellerId     = ((Number) pair[0]).longValue();
            String categoryName = (String) pair[1];
            ExamCategory category = categoryRepository.findByNameIgnoreCase(categoryName).orElse(null);
            if (category == null) continue;  // e.g. legacy "Other" — no matching taxonomy category
            if (qualRepository.findBySellerIdAndCategoryId(sellerId, category.getId()).isPresent()) continue;
            User seller = userRepository.findById(sellerId).orElse(null);
            if (seller == null) continue;

            qualRepository.save(SellerQualification.builder()
                    .seller(seller).category(category)
                    .status(QualificationStatus.APPROVED)
                    .bestScore(0).attemptsUsed(0)
                    .approvedAt(LocalDateTime.now())
                    .build());
            created++;
        }
        if (created > 0) log.info("Grandfathered {} seller-category qualifications from existing notes.", created);
    }
}

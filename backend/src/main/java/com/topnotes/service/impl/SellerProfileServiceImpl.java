package com.topnotes.service.impl;

import com.topnotes.dto.response.NoteResponse;
import com.topnotes.dto.response.SellerProfileResponse;
import com.topnotes.entity.User;
import com.topnotes.entity.enums.NoteStatus;
import com.topnotes.entity.enums.UserRole;
import com.topnotes.exception.ResourceNotFoundException;
import com.topnotes.repository.NoteRepository;
import com.topnotes.repository.PurchaseRepository;
import com.topnotes.repository.UserRepository;
import com.topnotes.service.NoteService;
import com.topnotes.service.SellerProfileService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Service
public class SellerProfileServiceImpl implements SellerProfileService {

    private final UserRepository     userRepository;
    private final NoteRepository     noteRepository;
    private final PurchaseRepository purchaseRepository;
    private final NoteService        noteService;

    public SellerProfileServiceImpl(UserRepository userRepository,
                                    NoteRepository noteRepository,
                                    PurchaseRepository purchaseRepository,
                                    NoteService noteService) {
        this.userRepository     = userRepository;
        this.noteRepository     = noteRepository;
        this.purchaseRepository = purchaseRepository;
        this.noteService        = noteService;
    }

    @Override
    @Transactional(readOnly = true)
    public SellerProfileResponse getProfile(Long sellerId) {
        User seller = userRepository.findById(sellerId)
                .filter(u -> u.getRole() == UserRole.SELLER)
                .orElseThrow(() -> new ResourceNotFoundException("Seller", sellerId));

        long reviews   = noteRepository.sumReviewCountBySellerId(sellerId);
        BigDecimal sumWeight = noteRepository.sumRatingWeightBySellerId(sellerId);
        BigDecimal avgRating = reviews > 0
                ? sumWeight.divide(BigDecimal.valueOf(reviews), 1, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        return SellerProfileResponse.builder()
                .id(seller.getId())
                .fullName(seller.getFullName())
                .profileImageUrl(seller.getProfileImageUrl())
                .verified(Boolean.TRUE.equals(seller.getIsVerified()))
                .institution(seller.getInstitution())
                .classLevel(seller.getClassLevel())
                .bio(seller.getBio())
                .joinedAt(seller.getCreatedAt())
                .totalNotes(noteRepository.countBySellerIdAndStatus(sellerId, NoteStatus.ACTIVE))
                .totalSales(purchaseRepository.countCompletedBySellerId(sellerId))
                .learners(purchaseRepository.countDistinctBuyersBySeller(sellerId))
                .averageRating(avgRating)
                .reviewCount(reviews)
                .domains(noteRepository.findActiveCategoriesBySeller(sellerId))
                .exams(noteRepository.findActiveExamsBySeller(sellerId))
                .subjects(noteRepository.findActiveSubjectsBySeller(sellerId))
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<NoteResponse> getActiveNotes(Long sellerId, Long viewerId) {
        return noteRepository
                .findBySellerIdAndStatusOrderBySubjectAscCreatedAtDesc(sellerId, NoteStatus.ACTIVE)
                .stream()
                .map(n -> noteService.toResponse(n, viewerId))
                .toList();
    }
}

package com.topnotes.repository;

import com.topnotes.entity.SellerQualification;
import com.topnotes.entity.enums.QualificationStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SellerQualificationRepository extends JpaRepository<SellerQualification, Long> {

    List<SellerQualification> findBySellerId(Long sellerId);

    Optional<SellerQualification> findBySellerIdAndCategoryId(Long sellerId, Long categoryId);

    /** Upload gate: is this seller approved to sell in this category? */
    boolean existsBySellerIdAndCategoryIdAndStatus(Long sellerId, Long categoryId, QualificationStatus status);

    List<SellerQualification> findBySellerIdAndStatus(Long sellerId, QualificationStatus status);

    /** Admin review queue — marksheets pending approval, newest first. */
    Page<SellerQualification> findByStatusOrderByUpdatedAtDesc(QualificationStatus status, Pageable pageable);

    long countByStatus(QualificationStatus status);
}

package com.topnotes.repository;

import com.topnotes.entity.ConsentRecord;
import com.topnotes.entity.enums.AgreementType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ConsentRecordRepository extends JpaRepository<ConsentRecord, Long> {

    /** Has the user already accepted this exact version of an agreement? */
    boolean existsByUserIdAndAgreementTypeAndVersion(Long userId, AgreementType type, Integer version);
}

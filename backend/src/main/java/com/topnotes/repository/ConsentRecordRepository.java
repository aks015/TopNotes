package com.topnotes.repository;

import com.topnotes.entity.ConsentRecord;
import com.topnotes.entity.enums.AgreementType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ConsentRecordRepository extends JpaRepository<ConsentRecord, Long> {

    /** Has the user already accepted this exact version of an agreement? */
    boolean existsByUserIdAndAgreementTypeAndVersion(Long userId, AgreementType type, Integer version);

    /** The originality/consent record tied to a specific note (for admin review). */
    Optional<ConsentRecord> findFirstByNoteIdAndAgreementType(Long noteId, AgreementType type);
}

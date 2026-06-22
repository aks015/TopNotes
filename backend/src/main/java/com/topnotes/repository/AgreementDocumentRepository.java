package com.topnotes.repository;

import com.topnotes.entity.AgreementDocument;
import com.topnotes.entity.enums.AgreementType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AgreementDocumentRepository extends JpaRepository<AgreementDocument, Long> {

    /** The current active version of an agreement type. */
    Optional<AgreementDocument> findByTypeAndActiveTrue(AgreementType type);

    Optional<AgreementDocument> findByTypeAndVersion(AgreementType type, Integer version);
}

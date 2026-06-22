package com.topnotes.service.impl;

import com.topnotes.dto.response.AgreementResponse;
import com.topnotes.entity.AgreementDocument;
import com.topnotes.entity.ConsentRecord;
import com.topnotes.entity.User;
import com.topnotes.entity.enums.AgreementType;
import com.topnotes.exception.BadRequestException;
import com.topnotes.exception.ResourceNotFoundException;
import com.topnotes.repository.AgreementDocumentRepository;
import com.topnotes.repository.ConsentRecordRepository;
import com.topnotes.repository.UserRepository;
import com.topnotes.service.ConsentService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Slf4j
public class ConsentServiceImpl implements ConsentService {

    private final AgreementDocumentRepository agreementRepository;
    private final ConsentRecordRepository     consentRepository;
    private final UserRepository              userRepository;

    public ConsentServiceImpl(AgreementDocumentRepository agreementRepository,
                              ConsentRecordRepository consentRepository,
                              UserRepository userRepository) {
        this.agreementRepository = agreementRepository;
        this.consentRepository   = consentRepository;
        this.userRepository      = userRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public AgreementResponse getAgreement(AgreementType type, Long userId) {
        AgreementDocument doc = activeDoc(type);
        boolean accepted = consentRepository
                .existsByUserIdAndAgreementTypeAndVersion(userId, type, doc.getVersion());
        return new AgreementResponse(doc.getType(), doc.getVersion(), doc.getTitle(),
                doc.getBody(), doc.getContentHash(), accepted);
    }

    @Override
    @Transactional
    public void recordConsent(Long userId, AgreementType type, Long noteId, String ipAddress, String userAgent) {
        AgreementDocument doc = activeDoc(type);

        // One-time agreements (no note): don't duplicate an existing acceptance of this version.
        if (noteId == null
                && consentRepository.existsByUserIdAndAgreementTypeAndVersion(userId, type, doc.getVersion())) {
            return;
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));

        consentRepository.save(ConsentRecord.builder()
                .user(user)
                .agreementType(type)
                .version(doc.getVersion())
                .contentHash(doc.getContentHash())
                .noteId(noteId)
                .ipAddress(truncate(ipAddress, 45))
                .userAgent(truncate(userAgent, 512))
                .build());

        log.info("Recorded {} v{} consent for user id={}{}",
                type, doc.getVersion(), userId, noteId != null ? " (note " + noteId + ")" : "");
    }

    @Override
    @Transactional(readOnly = true)
    public boolean hasAcceptedCurrent(Long userId, AgreementType type) {
        return agreementRepository.findByTypeAndActiveTrue(type)
                .map(doc -> consentRepository.existsByUserIdAndAgreementTypeAndVersion(userId, type, doc.getVersion()))
                .orElse(false);
    }

    // ── Helpers ───────────────────────────────────────────────

    private AgreementDocument activeDoc(AgreementType type) {
        return agreementRepository.findByTypeAndActiveTrue(type)
                .orElseThrow(() -> new BadRequestException("No active " + type + " is configured."));
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }
}

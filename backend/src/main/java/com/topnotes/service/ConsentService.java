package com.topnotes.service;

import com.topnotes.dto.response.AgreementResponse;
import com.topnotes.entity.enums.AgreementType;

/** Serves versioned agreement text and records legally-defensible consent. */
public interface ConsentService {

    /** Active agreement text for a type, plus whether {@code userId} already accepted this version. */
    AgreementResponse getAgreement(AgreementType type, Long userId);

    /**
     * Append a consent record for the active version of {@code type}. Captures the
     * request IP / user-agent. {@code noteId} is set only for per-upload declarations.
     * One-time agreements are not re-recorded if the user already accepted the
     * current version.
     */
    void recordConsent(Long userId, AgreementType type, Long noteId, String ipAddress, String userAgent);

    /** Whether the user has accepted the current active version of an agreement. */
    boolean hasAcceptedCurrent(Long userId, AgreementType type);
}

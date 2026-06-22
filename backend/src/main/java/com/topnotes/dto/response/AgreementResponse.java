package com.topnotes.dto.response;

import com.topnotes.entity.enums.AgreementType;

/** The current active agreement text plus whether the requesting user has accepted it. */
public record AgreementResponse(
        AgreementType type,
        int version,
        String title,
        String body,
        String contentHash,
        boolean accepted) {
}

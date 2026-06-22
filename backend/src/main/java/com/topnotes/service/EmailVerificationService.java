package com.topnotes.service;

import com.topnotes.dto.response.AuthResponse;

/** Issues and validates the email-confirmation OTP for the signed-in user. */
public interface EmailVerificationService {

    /**
     * Generate and email a fresh 6-digit code to the user, superseding any prior
     * outstanding code. Rate-limited to one request per cooldown window.
     */
    void sendCode(Long userId);

    /**
     * Validate the submitted code. On success marks the user's email verified and
     * returns a refreshed {@link AuthResponse} so the SPA picks up the new state.
     * Idempotent if the email is already verified.
     */
    AuthResponse verifyCode(Long userId, String code);
}

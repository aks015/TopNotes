package com.topnotes.service;

/** Outbound transactional email. Sends are best-effort and never break the calling flow. */
public interface EmailService {

    /**
     * Email a 6-digit verification code to the user. When SMTP isn't configured
     * (no MAIL_PASSWORD), the code is logged instead of sent so local/dev signup
     * still works end to end.
     */
    void sendVerificationCode(String toEmail, String name, String code);
}

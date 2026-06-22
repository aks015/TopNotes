package com.topnotes.service.impl;

import com.topnotes.service.EmailService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class EmailServiceImpl implements EmailService {

    private final JavaMailSender mailSender;

    @Value("${app.email.from}")
    private String from;

    /** Empty in dev → we log codes instead of attempting (and failing) a real send. */
    @Value("${spring.mail.password:}")
    private String mailPassword;

    public EmailServiceImpl(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    @Override
    @Async
    public void sendVerificationCode(String toEmail, String name, String code) {
        String firstName = (name == null || name.isBlank()) ? "there" : name.trim().split("\\s+")[0];
        String body = "Hi " + firstName + ",\n\n"
                + "Your TopNotes email verification code is:\n\n"
                + "    " + code + "\n\n"
                + "It expires in 10 minutes. If you didn't request this, you can safely ignore this email.\n\n"
                + "— Team TopNotes";

        // Dev / unconfigured SMTP: log the code so signup works without a mail server.
        if (mailPassword == null || mailPassword.isBlank()) {
            log.warn("[EMAIL DISABLED] Verification code for {} is {} — set MAIL_PASSWORD to send real email", toEmail, code);
            return;
        }

        try {
            SimpleMailMessage msg = new SimpleMailMessage();
            msg.setFrom(from);
            msg.setTo(toEmail);
            msg.setSubject("Your TopNotes verification code");
            msg.setText(body);
            mailSender.send(msg);
            log.info("Verification code email sent to {}", toEmail);
        } catch (Exception e) {
            // Best-effort: a mail failure must not break signup; the user can resend.
            log.error("Failed to send verification email to {}: {}", toEmail, e.getMessage());
        }
    }
}

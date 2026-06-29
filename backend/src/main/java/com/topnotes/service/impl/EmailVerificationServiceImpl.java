package com.topnotes.service.impl;

import com.topnotes.dto.response.AuthResponse;
import com.topnotes.entity.EmailVerificationToken;
import com.topnotes.entity.User;
import com.topnotes.exception.BadRequestException;
import com.topnotes.repository.EmailVerificationTokenRepository;
import com.topnotes.repository.UserRepository;
import com.topnotes.service.AuthService;
import com.topnotes.service.EmailService;
import com.topnotes.service.EmailVerificationService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;

@Service
@Slf4j
public class EmailVerificationServiceImpl implements EmailVerificationService {

    private static final int CODE_TTL_MINUTES        = 10;
    private static final int RESEND_COOLDOWN_SECONDS = 60;
    private static final int MAX_ATTEMPTS            = 5;

    private final UserRepository                   userRepository;
    private final EmailVerificationTokenRepository tokenRepository;
    private final EmailService                     emailService;
    private final PasswordEncoder                  passwordEncoder;
    private final AuthService                       authService;

    private final SecureRandom random = new SecureRandom();

    public EmailVerificationServiceImpl(UserRepository userRepository,
                                        EmailVerificationTokenRepository tokenRepository,
                                        EmailService emailService,
                                        PasswordEncoder passwordEncoder,
                                        AuthService authService) {
        this.userRepository  = userRepository;
        this.tokenRepository = tokenRepository;
        this.emailService    = emailService;
        this.passwordEncoder = passwordEncoder;
        this.authService     = authService;
    }

    @Override
    @Transactional
    public void sendCode(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BadRequestException("User not found"));
        if (Boolean.TRUE.equals(user.getEmailVerified())) {
            throw new BadRequestException("Your email is already verified");
        }

        // Rate-limit: block a resend while the previous code is still fresh.
        tokenRepository.findTopByUserIdOrderByCreatedAtDesc(userId).ifPresent(last -> {
            if (last.getConsumedAt() == null
                    && last.getCreatedAt() != null
                    && last.getCreatedAt().isAfter(LocalDateTime.now().minusSeconds(RESEND_COOLDOWN_SECONDS))) {
                throw new BadRequestException("Please wait a moment before requesting another code");
            }
        });

        tokenRepository.consumeAllForUser(userId);

        String code = generateCode();
        tokenRepository.save(EmailVerificationToken.builder()
                .user(user)
                .codeHash(passwordEncoder.encode(code))
                .expiresAt(LocalDateTime.now().plusMinutes(CODE_TTL_MINUTES))
                .build());

        emailService.sendVerificationCode(user.getEmail(), user.getFullName(), code);
        log.info("Issued email verification code to user id={}", userId);
    }

    @Override
    @Transactional
    public AuthResponse verifyCode(Long userId, String code) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BadRequestException("User not found"));

        // Already verified → idempotent success.
        if (Boolean.TRUE.equals(user.getEmailVerified())) {
            return authService.refreshToken(userId);
        }
        if (code == null || !code.trim().matches("\\d{6}")) {
            throw new BadRequestException("Enter the 6-digit code from your email");
        }

        EmailVerificationToken token = tokenRepository.findTopByUserIdOrderByCreatedAtDesc(userId)
                .filter(t -> t.getConsumedAt() == null)
                .orElseThrow(() -> new BadRequestException("No active code — request a new one"));

        if (token.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new BadRequestException("This code has expired — request a new one");
        }
        if (token.getAttempts() >= MAX_ATTEMPTS) {
            throw new BadRequestException("Too many attempts — request a new code");
        }
        if (!passwordEncoder.matches(code.trim(), token.getCodeHash())) {
            token.setAttempts(token.getAttempts() + 1);
            tokenRepository.save(token);
            throw new BadRequestException("Incorrect code — please try again");
        }

        token.setConsumedAt(LocalDateTime.now());
        tokenRepository.save(token);
        user.setEmailVerified(true);
        userRepository.save(user);
        log.info("Email verified for user id={}", userId);

        return authService.refreshToken(userId);
    }

    private String generateCode() {
        return String.format("%06d", random.nextInt(1_000_000));
    }
}

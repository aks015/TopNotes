    package com.topnotes.service.impl;

import com.topnotes.dto.request.LoginRequest;
import com.topnotes.dto.request.RegisterRequest;
import com.topnotes.dto.response.AuthResponse;
import com.topnotes.entity.User;
import com.topnotes.entity.enums.UserRole;
import com.topnotes.entity.enums.UserStatus;
import com.topnotes.exception.BadRequestException;
import com.topnotes.repository.UserRepository;
import com.topnotes.security.JwtUtil;
import com.topnotes.service.AuthService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Slf4j
public class AuthServiceImpl implements AuthService {

    private final UserRepository        userRepository;
    private final PasswordEncoder       passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtUtil               jwtUtil;

    public AuthServiceImpl(UserRepository userRepository,
                           PasswordEncoder passwordEncoder,
                           AuthenticationManager authenticationManager,
                           JwtUtil jwtUtil) {
        this.userRepository        = userRepository;
        this.passwordEncoder       = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.jwtUtil               = jwtUtil;
    }

    @Override
    @Transactional
    public AuthResponse register(RegisterRequest request) {
        log.info("Registering new user: {}", request.getEmail());

        if (userRepository.existsByEmail(request.getEmail())) {
            throw new BadRequestException("Email address is already registered");
        }

        // Every signup is a BUYER; selling is opted into later via become-seller.
        // Phone is optional and only persisted when provided.
        String phone = request.getPhone() == null || request.getPhone().isBlank()
                ? null : request.getPhone().trim();

        User user = User.builder()
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName())
                .phone(phone)
                .role(UserRole.BUYER)
                .build();

        User saved = userRepository.save(user);
        log.info("User registered with id={}", saved.getId());

        return buildAuthResponse(saved);
    }

    @Override
    public AuthResponse login(LoginRequest request) {
        log.info("Login attempt for: {}", request.getEmail());

        // Spring Security validates credentials; throws BadCredentialsException on failure
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword()));

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new BadRequestException("User not found"));

        log.info("User id={} logged in successfully", user.getId());
        return buildAuthResponse(user);
    }

    @Override
    @Transactional
    public AuthResponse becomeSeller(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BadRequestException("User not found"));

        if (user.getRole() == UserRole.ADMIN) {
            throw new BadRequestException("Admin accounts cannot become sellers");
        }
        if (user.getRole() != UserRole.SELLER) {
            user.setRole(UserRole.SELLER);
            user = userRepository.save(user);
            log.info("User id={} upgraded BUYER -> SELLER", user.getId());
        }

        // Re-issue tokens so the new role/authority takes effect immediately.
        return buildAuthResponse(user);
    }

    @Override
    public AuthResponse refreshToken(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BadRequestException("User not found"));
        return buildAuthResponse(user);
    }

    @Override
    public AuthResponse refreshAccessToken(String refreshToken) {
        if (refreshToken == null
                || !jwtUtil.validateToken(refreshToken)
                || !jwtUtil.isRefreshToken(refreshToken)) {
            throw new BadRequestException("Session expired — please log in again");
        }

        String email = jwtUtil.extractEmail(refreshToken);
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new BadRequestException("User not found"));

        // A suspended/deleted account must not be able to refresh its way back in.
        if (user.getStatus() != UserStatus.ACTIVE) {
            throw new BadRequestException("Account is not active");
        }

        log.info("Refreshing access token for user id={}", user.getId());
        return buildAuthResponse(user);
    }

    @Override
    public String getUpiId(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new BadRequestException("User not found"))
                .getUpiId();
    }

    @Override
    @Transactional
    public void updateUpiId(Long userId, String upiId) {
        if (upiId == null || !upiId.trim().matches("^[\\w.\\-]{2,}@[a-zA-Z]{2,}$")) {
            throw new BadRequestException("Enter a valid UPI ID (e.g. name@bank)");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BadRequestException("User not found"));
        user.setUpiId(upiId.trim());
        userRepository.save(user);
    }

    @Override
    @Transactional
    public void changePassword(Long userId, String currentPassword, String newPassword) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BadRequestException("User not found"));
        if (currentPassword == null || !passwordEncoder.matches(currentPassword, user.getPassword())) {
            throw new BadRequestException("Current password is incorrect");
        }
        if (newPassword == null || newPassword.length() < 8) {
            throw new BadRequestException("New password must be at least 8 characters");
        }
        if (passwordEncoder.matches(newPassword, user.getPassword())) {
            throw new BadRequestException("New password must be different from the current one");
        }
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }

    @Override
    @Transactional
    public AuthResponse updateProfile(Long userId, String fullName, String phone) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BadRequestException("User not found"));
        if (fullName == null || fullName.trim().length() < 2) {
            throw new BadRequestException("Full name must be at least 2 characters");
        }
        if (phone == null || !phone.trim().matches("^[6-9]\\d{9}$")) {
            throw new BadRequestException("Enter a valid 10-digit Indian mobile number");
        }
        user.setFullName(fullName.trim());
        user.setPhone(phone.trim());
        return buildAuthResponse(userRepository.save(user));
    }

    @Override
    @Transactional
    public AuthResponse setProfileImage(Long userId, String imageUrl) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BadRequestException("User not found"));
        user.setProfileImageUrl(imageUrl);
        return buildAuthResponse(userRepository.save(user));
    }

    // ── Private helpers ───────────────────────────────────────

    private AuthResponse buildAuthResponse(User user) {
        String accessToken  = jwtUtil.generateToken(user.getEmail(), user.getRole().name(), user.getId());
        String refreshToken = jwtUtil.generateRefreshToken(user.getEmail(), user.getId());
        return AuthResponse.builder()
                .userId(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .phone(user.getPhone())
                .profileImageUrl(user.getProfileImageUrl())
                .role(user.getRole())
                .isVerified(user.getIsVerified())
                .emailVerified(user.getEmailVerified())
                .createdAt(user.getCreatedAt())
                .token(accessToken)
                .refreshToken(refreshToken)
                .build();
    }
}

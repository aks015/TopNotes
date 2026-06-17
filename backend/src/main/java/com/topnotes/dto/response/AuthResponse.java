package com.topnotes.dto.response;

import com.topnotes.entity.enums.UserRole;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

/** Returned on successful registration or login. */
@Getter
@Builder
public class AuthResponse {

    private Long     userId;
    private String   email;
    private String   fullName;
    private String   phone;
    private String   profileImageUrl;
    private UserRole role;
    private Boolean  isVerified;
    private LocalDateTime createdAt;
    private String   token;
    private String   refreshToken;

    @Builder.Default
    private String tokenType = "Bearer";
}

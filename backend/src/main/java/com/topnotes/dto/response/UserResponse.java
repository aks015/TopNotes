package com.topnotes.dto.response;

import com.topnotes.entity.enums.UserRole;
import com.topnotes.entity.enums.UserStatus;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

/** Full user profile — used in admin endpoints. Never exposes password. */
@Getter
@Builder
public class UserResponse {
    private Long          id;
    private String        email;
    private String        fullName;
    private String        phone;
    private UserRole      role;
    private UserStatus    status;
    private String        profileImageUrl;
    private String        classLevel;
    private String        institution;
    private String        bio;
    private Boolean       isVerified;
    private Boolean       testPassed;
    private Integer       testScore;
    private Boolean       marksheetApproved;
    /** Uploaded marksheet image URL — for admin verification review. */
    private String        marksheetUrl;
    private LocalDateTime createdAt;
}

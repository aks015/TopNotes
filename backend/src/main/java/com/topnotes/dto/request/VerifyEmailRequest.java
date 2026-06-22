package com.topnotes.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.Setter;

/** Payload for POST /auth/email/verify. */
@Getter
@Setter
public class VerifyEmailRequest {

    @NotBlank(message = "Verification code is required")
    @Pattern(regexp = "\\d{6}", message = "Enter the 6-digit code")
    private String code;
}

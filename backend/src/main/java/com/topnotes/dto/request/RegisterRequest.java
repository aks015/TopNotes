package com.topnotes.dto.request;

import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;

/**
 * Payload for the /auth/register endpoint. Every signup creates a BUYER account;
 * selling is opted into later via /profile/become-seller, so no role is accepted here.
 */
@Getter
@Setter
public class RegisterRequest {

    @NotBlank(message = "Full name is required")
    @Size(min = 2, max = 100, message = "Full name must be between 2 and 100 characters")
    private String fullName;

    @NotBlank(message = "Email is required")
    @Email(message = "Email must be a valid address")
    @Size(max = 150, message = "Email must not exceed 150 characters")
    private String email;

    @NotBlank(message = "Password is required")
    @Size(min = 8, max = 100, message = "Password must be at least 8 characters")
    private String password;

    /**
     * Optional at signup. The {@code ^$} branch lets it be omitted while still
     * rejecting malformed numbers. Collected later (e.g. payout setup) when needed.
     */
    @Pattern(regexp = "^$|^[6-9]\\d{9}$", message = "Enter a valid 10-digit Indian mobile number")
    private String phone;
}

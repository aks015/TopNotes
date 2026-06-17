package com.topnotes.service;

import com.topnotes.dto.request.LoginRequest;
import com.topnotes.dto.request.RegisterRequest;
import com.topnotes.dto.response.AuthResponse;

/** Authentication operations — registration, login, and role upgrade. */
public interface AuthService {
    AuthResponse register(RegisterRequest request);
    AuthResponse login(LoginRequest request);

    /**
     * Upgrade an existing BUYER into a SELLER so they can start selling
     * (still requires completing the verification flow before publishing).
     * Returns a freshly-minted JWT reflecting the new role. Idempotent for
     * users who are already sellers; rejected for admins.
     */
    AuthResponse becomeSeller(Long userId);

    /**
     * Re-issue a fresh JWT for the current user reflecting their latest account
     * state (role, verification). Lets a just-approved seller pick up
     * {@code isVerified=true} on reload without logging out and back in.
     */
    AuthResponse refreshToken(Long userId);

    /**
     * Exchange a valid (non-expired, refresh-type) refresh token for a fresh
     * access token + rotated refresh token. Used by the SPA to survive access
     * token expiry without forcing the user to log in again. Rejects invalid,
     * expired, or non-refresh tokens, and suspended/deleted accounts.
     */
    AuthResponse refreshAccessToken(String refreshToken);

    /** Current seller payout UPI (null if not set yet). */
    String getUpiId(Long userId);

    /** Validate and save the seller's payout UPI VPA. */
    void updateUpiId(Long userId, String upiId);

    /** Change the signed-in user's password after verifying the current one. */
    void changePassword(Long userId, String currentPassword, String newPassword);

    /** Update the signed-in user's display name and phone; returns a fresh AuthResponse. */
    AuthResponse updateProfile(Long userId, String fullName, String phone);

    /** Save the signed-in user's profile image URL (already uploaded to storage). */
    AuthResponse setProfileImage(Long userId, String imageUrl);
}

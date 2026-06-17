package com.topnotes.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

/**
 * Centralises all JWT operations: generation, validation, and claim extraction.
 * Uses HMAC-SHA256 with a configurable secret.
 */
@Component
@Slf4j
public class JwtUtil {

    @Value("${app.jwt.secret}")
    private String jwtSecret;

    @Value("${app.jwt.expiration-ms}")
    private long jwtExpirationMs;

    @Value("${app.jwt.refresh-expiration-ms}")
    private long refreshExpirationMs;

    /** Marks the token kind so a refresh token can't be used as an access token. */
    private static final String TYPE_CLAIM   = "type";
    private static final String TYPE_REFRESH = "refresh";

    // ── Key building ──────────────────────────────────────────

    private SecretKey getSigningKey() {
        byte[] keyBytes = jwtSecret.getBytes();
        return Keys.hmacShaKeyFor(keyBytes);
    }

    // ── Token generation ──────────────────────────────────────

    /**
     * Generates a signed JWT containing the user's email, role, and ID.
     *
     * @param email  subject (used as username)
     * @param role   user's platform role
     * @param userId database primary key
     * @return signed JWT string
     */
    public String generateToken(String email, String role, Long userId) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("role",   role);
        claims.put("userId", userId);

        Date now    = new Date();
        Date expiry = new Date(now.getTime() + jwtExpirationMs);

        return Jwts.builder()
                .claims(claims)
                .subject(email)
                .issuedAt(now)
                .expiration(expiry)
                .signWith(getSigningKey())
                .compact();
    }

    /**
     * Generates a long-lived refresh token (no role claim — the role is read
     * fresh from the DB when the refresh is exchanged for a new access token).
     */
    public String generateRefreshToken(String email, Long userId) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("userId",   userId);
        claims.put(TYPE_CLAIM, TYPE_REFRESH);

        Date now    = new Date();
        Date expiry = new Date(now.getTime() + refreshExpirationMs);

        return Jwts.builder()
                .claims(claims)
                .subject(email)
                .issuedAt(now)
                .expiration(expiry)
                .signWith(getSigningKey())
                .compact();
    }

    /** True only for tokens minted by {@link #generateRefreshToken}. */
    public boolean isRefreshToken(String token) {
        try {
            return TYPE_REFRESH.equals(parseClaims(token).get(TYPE_CLAIM, String.class));
        } catch (Exception e) {
            return false;
        }
    }

    // ── Claim extraction ──────────────────────────────────────

    public String extractEmail(String token) {
        return parseClaims(token).getSubject();
    }

    public String extractRole(String token) {
        return parseClaims(token).get("role", String.class);
    }

    public Long extractUserId(String token) {
        Object raw = parseClaims(token).get("userId");
        if (raw instanceof Integer i) return i.longValue();
        if (raw instanceof Long    l) return l;
        return null;
    }

    public Date extractExpiration(String token) {
        return parseClaims(token).getExpiration();
    }

    // ── Validation ────────────────────────────────────────────

    /**
     * Returns true if the token is syntactically valid and not expired.
     */
    public boolean validateToken(String token) {
        try {
            parseClaims(token);
            return true;
        } catch (ExpiredJwtException e) {
            log.warn("JWT token expired: {}", e.getMessage());
        } catch (MalformedJwtException e) {
            log.warn("Invalid JWT token: {}", e.getMessage());
        } catch (SecurityException e) {
            log.warn("JWT signature validation failed: {}", e.getMessage());
        } catch (IllegalArgumentException e) {
            log.warn("JWT claims are empty: {}", e.getMessage());
        }
        return false;
    }

    // ── Internal helper ───────────────────────────────────────

    private Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}

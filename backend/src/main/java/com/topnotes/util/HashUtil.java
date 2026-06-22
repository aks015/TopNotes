package com.topnotes.util;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/** Small hashing helpers. */
public final class HashUtil {

    private HashUtil() {}

    /** Lower-case hex SHA-256 of the given text — used to fingerprint accepted agreement text. */
    public static String sha256Hex(String text) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(text == null ? new byte[0] : text.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(digest.length * 2);
            for (byte b : digest) sb.append(Character.forDigit((b >> 4) & 0xF, 16)).append(Character.forDigit(b & 0xF, 16));
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 is guaranteed present on every JVM; this never happens.
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}

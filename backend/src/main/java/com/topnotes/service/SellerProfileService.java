package com.topnotes.service;

import com.topnotes.dto.response.NoteResponse;
import com.topnotes.dto.response.SellerProfileResponse;

import java.util.List;

/** Public, read-only seller profile (the "/u/{id}" page). */
public interface SellerProfileService {

    /** Identity + live aggregate stats + coverage for a seller. */
    SellerProfileResponse getProfile(Long sellerId);

    /** A seller's published (ACTIVE) notes, ordered subject→newest. viewerId may be null (anonymous). */
    List<NoteResponse> getActiveNotes(Long sellerId, Long viewerId);
}

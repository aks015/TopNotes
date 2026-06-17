package com.topnotes.service;

import com.topnotes.dto.request.NoteCreateRequest;
import com.topnotes.dto.request.NoteUpdateRequest;
import com.topnotes.dto.request.PriceUpdateRequest;
import com.topnotes.dto.response.NoteResponse;
import com.topnotes.dto.response.PriceSuggestionResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

/** CRUD and search operations for note listings. */
public interface NoteService {

    /** Upload a new note — PDF and optional thumbnail are required. */
    NoteResponse createNote(NoteCreateRequest request,
                            MultipartFile pdf,
                            MultipartFile thumbnail,
                            Long sellerId);

    /** Paginated search with optional multi-value taxonomy filters. viewerId sets isPurchased flag. */
    Page<NoteResponse> searchNotes(String keyword,
                                   List<String> categories,
                                   List<String> exams,
                                   List<String> subjects,
                                   Pageable pageable,
                                   Long viewerId);

    /** Single note detail. viewerId may be null for anonymous access. */
    NoteResponse getNoteById(Long noteId, Long viewerId);

    /** All notes owned by a seller (includes INACTIVE, excludes DELETED), enriched with analytics. */
    Page<NoteResponse> getSellerNotes(Long sellerId, Pageable pageable);

    /** Soft-deleted notes the seller can still restore. */
    Page<NoteResponse> getSellerTrash(Long sellerId, Pageable pageable);

    /** Duplicate a listing (as a hidden draft) to use as a starting point. */
    NoteResponse cloneNote(Long noteId, Long sellerId);

    /** Restore a soft-deleted note (back to hidden/INACTIVE). */
    NoteResponse restoreNote(Long noteId, Long sellerId);

    /** Seller updates price only — no other fields. */
    NoteResponse updatePrice(Long noteId, PriceUpdateRequest request, Long sellerId);

    /** Toggle a listing's visibility: true → ACTIVE (published), false → INACTIVE (hidden). */
    NoteResponse setVisibility(Long noteId, boolean active, Long sellerId);

    /** Seller edits a listing's fields, optionally replacing the PDF and/or cover. */
    NoteResponse updateNote(Long noteId,
                            NoteUpdateRequest request,
                            org.springframework.web.multipart.MultipartFile pdf,
                            org.springframework.web.multipart.MultipartFile thumbnail,
                            Long sellerId);

    /** Median price of comparable active notes (same exam+subject) to guide pricing. */
    PriceSuggestionResponse getPriceSuggestion(String exam, String subject);

    /** Soft-delete — sets status to DELETED. */
    void deleteNote(Long noteId, Long sellerId);

    /** Available filter options for the browse dropdowns. */
    Map<String, List<String>> getFilterOptions();

    /**
     * Maps a Note entity to NoteResponse DTO.
     * Exposed so DashboardService can reuse the mapping logic.
     */
    NoteResponse toResponse(com.topnotes.entity.Note note, Long viewerId);
}

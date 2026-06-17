package com.topnotes.service.impl;

import com.topnotes.dto.request.NoteCreateRequest;
import com.topnotes.dto.request.NoteUpdateRequest;
import com.topnotes.dto.request.PriceUpdateRequest;
import com.topnotes.dto.response.NoteResponse;
import com.topnotes.dto.response.PriceSuggestionResponse;
import com.topnotes.dto.response.SellerPublicProfile;
import com.topnotes.entity.ExamCategory;
import com.topnotes.entity.Note;
import com.topnotes.entity.User;
import com.topnotes.entity.enums.NoteStatus;
import com.topnotes.exception.BadRequestException;
import com.topnotes.exception.ResourceNotFoundException;
import com.topnotes.exception.UnauthorizedException;
import com.topnotes.repository.ExamCategoryRepository;
import com.topnotes.repository.ExamRepository;
import com.topnotes.repository.NoteRepository;
import com.topnotes.repository.PurchaseRepository;
import com.topnotes.repository.SubjectRepository;
import com.topnotes.repository.UserRepository;
import com.topnotes.service.NoteService;
import com.topnotes.service.SellerQualificationService;
import com.topnotes.util.FileUploadUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@Slf4j
public class NoteServiceImpl implements NoteService {

    private final NoteRepository         noteRepository;
    private final UserRepository         userRepository;
    private final PurchaseRepository     purchaseRepository;
    private final FileUploadUtil         fileUploadUtil;
    private final ExamCategoryRepository categoryRepository;
    private final ExamRepository         examRepository;
    private final SubjectRepository      subjectRepository;
    private final SellerQualificationService qualificationService;

    public NoteServiceImpl(NoteRepository noteRepository,
                           UserRepository userRepository,
                           PurchaseRepository purchaseRepository,
                           FileUploadUtil fileUploadUtil,
                           ExamCategoryRepository categoryRepository,
                           ExamRepository examRepository,
                           SubjectRepository subjectRepository,
                           SellerQualificationService qualificationService) {
        this.noteRepository       = noteRepository;
        this.userRepository       = userRepository;
        this.purchaseRepository   = purchaseRepository;
        this.fileUploadUtil       = fileUploadUtil;
        this.categoryRepository   = categoryRepository;
        this.examRepository       = examRepository;
        this.subjectRepository    = subjectRepository;
        this.qualificationService = qualificationService;
    }

    /**
     * Enforces per-category selling rights + taxonomy integrity. A seller can ONLY
     * publish in categories they're APPROVED in, and the (category, exam, subject)
     * triple must be internally consistent. Server-side — can't be bypassed by the UI.
     */
    private void authorizeListing(Long sellerId, String categoryName, String examName, String subjectName) {
        if (categoryName == null || categoryName.isBlank()) {
            throw new BadRequestException("Exam category is required.");
        }
        ExamCategory category = categoryRepository.findByNameIgnoreCase(categoryName.trim())
                .orElseThrow(() -> new BadRequestException("Unknown exam category: " + categoryName));

        if (!qualificationService.isApprovedFor(sellerId, category.getId())) {
            throw new UnauthorizedException(
                    "You're not qualified to sell in " + category.getName()
                    + ". Pass the " + category.getName() + " qualification test first.");
        }
        // Taxonomy triple: exam must belong to the category, subject to the exam.
        var exam = examRepository.findByCategoryIdAndNameIgnoreCase(category.getId(), examName == null ? "" : examName.trim())
                .orElseThrow(() -> new BadRequestException("\"" + examName + "\" is not an exam under " + category.getName() + "."));
        if (subjectName != null && !subjectName.isBlank()
                && !subjectRepository.existsByExamIdAndNameIgnoreCase(exam.getId(), subjectName.trim())) {
            throw new BadRequestException("\"" + subjectName + "\" is not a subject under " + exam.getName() + ".");
        }
    }

    // ── Create ────────────────────────────────────────────────

    @Override
    @Transactional
    public NoteResponse createNote(NoteCreateRequest request,
                                   MultipartFile pdf,
                                   MultipartFile thumbnail,
                                   Long sellerId) {
        User seller = fetchUser(sellerId);

        // Per-category gate: seller must be APPROVED in this note's category + valid taxonomy.
        authorizeListing(sellerId, request.getCategory(), request.getExam(), request.getSubject());

        String pdfUrl;
        try {
            pdfUrl = fileUploadUtil.storePdf(pdf);
        } catch (IOException e) {
            log.error("Failed to store PDF for seller {}: {}", sellerId, e.getMessage());
            throw new BadRequestException("Failed to upload PDF: " + e.getMessage());
        }

        // Page count drives the "X pages" badge on cards and reading-progress denominators.
        int totalPages = countPdfPages(pdf);

        String thumbnailUrl = null;
        if (thumbnail != null && !thumbnail.isEmpty()) {
            try {
                thumbnailUrl = fileUploadUtil.storeThumbnail(thumbnail);
            } catch (IOException e) {
                log.warn("Failed to store thumbnail for seller {}: {}", sellerId, e.getMessage());
                // Non-fatal — proceed without thumbnail
            }
        }
        // No cover supplied → auto-generate one from the PDF's first page.
        if (thumbnailUrl == null) {
            thumbnailUrl = renderCoverFromPdf(pdf);
        }

        Note note = Note.builder()
                .title(request.getTitle())
                .description(request.getDescription())
                .category(request.getCategory())
                .exam(request.getExam())
                .subject(request.getSubject())
                .classLevel(request.getLevel())
                .price(request.getPrice())
                .pdfUrl(pdfUrl)
                .previewUrl(pdfUrl)   // Backend serves page 1 in controller
                .thumbnailUrl(thumbnailUrl)
                .totalPages(totalPages)
                .seller(seller)
                .build();

        Note saved = noteRepository.save(note);
        log.info("Note id={} created by seller id={}", saved.getId(), sellerId);
        return toResponse(saved, null);
    }

    // ── Search / Read ─────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public Page<NoteResponse> searchNotes(String keyword,
                                          List<String> categories,
                                          List<String> exams,
                                          List<String> subjects,
                                          Pageable pageable,
                                          Long viewerId) {
        String normalizedKeyword = keyword == null ? "" : keyword.trim().toLowerCase(Locale.ROOT);

        // A null/empty filter is "match all"; we still pass a non-empty dummy
        // list so the JPQL IN clause stays valid SQL.
        boolean allCategory = categories == null || categories.isEmpty();
        boolean allExam     = exams      == null || exams.isEmpty();
        boolean allSubject  = subjects   == null || subjects.isEmpty();

        return noteRepository
                .searchNotes(
                        normalizedKeyword,
                        allCategory, allCategory ? List.of("") : categories,
                        allExam,     allExam     ? List.of("") : exams,
                        allSubject,  allSubject  ? List.of("") : subjects,
                        pageable)
                .map(note -> toResponse(note, viewerId));
    }

    @Override
    @Transactional
    public NoteResponse getNoteById(Long noteId, Long viewerId) {
        Note note = noteRepository.findById(noteId)
                .filter(n -> n.getStatus() != NoteStatus.DELETED)
                .orElseThrow(() -> new ResourceNotFoundException("Note", noteId));
        // Count a view only when it isn't the seller looking at their own listing.
        if (viewerId == null || !viewerId.equals(note.getSeller().getId())) {
            noteRepository.incrementViewCount(noteId);
        }
        return toResponse(note, viewerId);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<NoteResponse> getSellerNotes(Long sellerId, Pageable pageable) {
        SellerEnrichment e = sellerEnrichment(sellerId);
        return noteRepository
                .findBySellerIdAndStatusNot(sellerId, NoteStatus.DELETED, pageable)
                .map(note -> enrichForSeller(toResponse(note, null), note, e));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<NoteResponse> getSellerTrash(Long sellerId, Pageable pageable) {
        return noteRepository
                .findBySellerIdAndStatus(sellerId, NoteStatus.DELETED, pageable)
                .map(note -> toResponse(note, null));
    }

    /** Holds the three batched per-note aggregates so we run them once per page, not per note. */
    private record SellerEnrichment(Map<Long, BigDecimal> revenue,
                                    Map<Long, java.time.LocalDateTime> lastSold,
                                    Map<Long, List<Integer>> trend) {}

    private SellerEnrichment sellerEnrichment(Long sellerId) {
        Map<Long, BigDecimal> revenue = new HashMap<>();
        for (Object[] r : purchaseRepository.revenueByNoteForSeller(sellerId)) {
            revenue.put(((Number) r[0]).longValue(), r[1] != null ? new BigDecimal(r[1].toString()) : BigDecimal.ZERO);
        }
        Map<Long, java.time.LocalDateTime> lastSold = new HashMap<>();
        for (Object[] r : purchaseRepository.lastSoldByNoteForSeller(sellerId)) {
            if (r[1] != null) lastSold.put(((Number) r[0]).longValue(), (java.time.LocalDateTime) r[1]);
        }
        // 30-day daily sparkline buckets.
        java.time.LocalDate start = java.time.LocalDate.now().minusDays(29);
        Map<Long, List<Integer>> trend = new HashMap<>();
        Map<Long, Map<String, Integer>> byNoteDate = new HashMap<>();
        for (Object[] r : purchaseRepository.dailySalesByNoteForSeller(
                sellerId, start.atStartOfDay())) {
            Long noteId = ((Number) r[0]).longValue();
            byNoteDate.computeIfAbsent(noteId, k -> new HashMap<>())
                    .put(r[1].toString(), ((Number) r[2]).intValue());
        }
        byNoteDate.forEach((noteId, dateMap) -> {
            List<Integer> series = new ArrayList<>(30);
            for (int i = 0; i < 30; i++) {
                series.add(dateMap.getOrDefault(start.plusDays(i).toString(), 0));
            }
            trend.put(noteId, series);
        });

        return new SellerEnrichment(revenue, lastSold, trend);
    }

    private NoteResponse enrichForSeller(NoteResponse dto, Note note, SellerEnrichment e) {
        dto.setRevenue(e.revenue().getOrDefault(note.getId(), BigDecimal.ZERO));
        dto.setLastSoldAt(e.lastSold().get(note.getId()));
        dto.setSalesTrend(e.trend().get(note.getId()));
        PriceSuggestionResponse sugg = getPriceSuggestion(note.getExam(), note.getSubject());
        dto.setSuggestedPrice(sugg.price());
        return dto;
    }

    // ── Update ────────────────────────────────────────────────

    @Override
    @Transactional
    public NoteResponse updatePrice(Long noteId, PriceUpdateRequest request, Long sellerId) {
        Note note = fetchSellerOwnedNote(noteId, sellerId);
        note.setPrice(request.getPrice());
        log.info("Note id={} price updated to {} by seller id={}", noteId, request.getPrice(), sellerId);
        return toResponse(noteRepository.save(note), null);
    }

    @Override
    @Transactional
    public NoteResponse updateNote(Long noteId,
                                   NoteUpdateRequest request,
                                   MultipartFile pdf,
                                   MultipartFile thumbnail,
                                   Long sellerId) {
        Note note = fetchSellerOwnedNote(noteId, sellerId);

        // Edit guard: can't switch a note into a category you're not approved in.
        authorizeListing(sellerId, request.getCategory(), request.getExam(), request.getSubject());

        note.setTitle(request.getTitle());
        note.setDescription(request.getDescription());
        note.setCategory(request.getCategory());
        note.setExam(request.getExam());
        note.setSubject(request.getSubject());
        note.setClassLevel(request.getLevel());
        note.setPrice(request.getPrice());

        // Optional new PDF — re-store and re-count pages.
        if (pdf != null && !pdf.isEmpty()) {
            try {
                String pdfUrl = fileUploadUtil.storePdf(pdf);
                note.setPdfUrl(pdfUrl);
                note.setPreviewUrl(pdfUrl);
                note.setTotalPages(countPdfPages(pdf));
            } catch (IOException e) {
                throw new BadRequestException("Failed to upload PDF: " + e.getMessage());
            }
        }

        // Optional new cover.
        if (thumbnail != null && !thumbnail.isEmpty()) {
            try {
                note.setThumbnailUrl(fileUploadUtil.storeThumbnail(thumbnail));
            } catch (IOException e) {
                log.warn("Failed to store thumbnail on update for note {}: {}", noteId, e.getMessage());
            }
        }

        log.info("Note id={} updated by seller id={}", noteId, sellerId);
        return toResponse(noteRepository.save(note), null);
    }

    @Override
    @Transactional
    public NoteResponse setVisibility(Long noteId, boolean active, Long sellerId) {
        Note note = fetchSellerOwnedNote(noteId, sellerId);
        note.setStatus(active ? NoteStatus.ACTIVE : NoteStatus.INACTIVE);
        log.info("Note id={} visibility set to {} by seller id={}", noteId, note.getStatus(), sellerId);
        return toResponse(noteRepository.save(note), null);
    }

    @Override
    @Transactional(readOnly = true)
    public PriceSuggestionResponse getPriceSuggestion(String exam, String subject) {
        if (exam == null || subject == null || exam.isBlank() || subject.isBlank()) {
            return new PriceSuggestionResponse(null, 0);
        }
        List<BigDecimal> prices = noteRepository.findActivePrices(exam, subject)
                .stream().filter(java.util.Objects::nonNull).sorted().toList();
        if (prices.isEmpty()) return new PriceSuggestionResponse(null, 0);
        int n = prices.size();
        BigDecimal median = (n % 2 == 1)
                ? prices.get(n / 2)
                : prices.get(n / 2 - 1).add(prices.get(n / 2)).divide(BigDecimal.valueOf(2), 2, java.math.RoundingMode.HALF_UP);
        // Round to a clean rupee value.
        return new PriceSuggestionResponse(median.setScale(0, java.math.RoundingMode.HALF_UP), n);
    }

    /** Renders page 1 of a PDF to a PNG cover and uploads it; null if rendering fails (non-fatal). */
    private String renderCoverFromPdf(MultipartFile pdf) {
        try (org.apache.pdfbox.pdmodel.PDDocument doc = org.apache.pdfbox.Loader.loadPDF(pdf.getBytes())) {
            if (doc.getNumberOfPages() == 0) return null;
            org.apache.pdfbox.rendering.PDFRenderer renderer = new org.apache.pdfbox.rendering.PDFRenderer(doc);
            java.awt.image.BufferedImage image = renderer.renderImageWithDPI(0, 130);
            java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
            javax.imageio.ImageIO.write(image, "png", out);
            return fileUploadUtil.storeGeneratedThumbnail(out.toByteArray());
        } catch (Exception e) {
            log.warn("Could not auto-generate cover from PDF: {}", e.getMessage());
            return null;
        }
    }

    @Override
    @Transactional
    public NoteResponse cloneNote(Long noteId, Long sellerId) {
        Note src = fetchSellerOwnedNote(noteId, sellerId);
        Note copy = Note.builder()
                .title(truncate(src.getTitle() + " (copy)", 250))
                .description(src.getDescription())
                .category(src.getCategory())
                .exam(src.getExam())
                .subject(src.getSubject())
                .classLevel(src.getClassLevel())
                .price(src.getPrice())
                .pdfUrl(src.getPdfUrl())
                .previewUrl(src.getPreviewUrl())
                .thumbnailUrl(src.getThumbnailUrl())
                .totalPages(src.getTotalPages())
                .seller(src.getSeller())
                .status(NoteStatus.INACTIVE)   // clone starts hidden — seller reviews then publishes
                .build();
        Note saved = noteRepository.save(copy);
        log.info("Note id={} cloned to id={} by seller id={}", noteId, saved.getId(), sellerId);
        return toResponse(saved, null);
    }

    @Override
    @Transactional
    public NoteResponse restoreNote(Long noteId, Long sellerId) {
        Note note = noteRepository.findById(noteId)
                .filter(n -> n.getSeller().getId().equals(sellerId))
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Note not found or you don't have permission to modify it"));
        note.setStatus(NoteStatus.INACTIVE);   // restore as hidden so it doesn't silently republish
        log.info("Note id={} restored by seller id={}", noteId, sellerId);
        return toResponse(noteRepository.save(note), null);
    }

    private String truncate(String s, int max) {
        return s != null && s.length() > max ? s.substring(0, max) : s;
    }

    // ── Delete ────────────────────────────────────────────────

    @Override
    @Transactional
    public void deleteNote(Long noteId, Long sellerId) {
        Note note = fetchSellerOwnedNote(noteId, sellerId);
        note.setStatus(NoteStatus.DELETED);
        noteRepository.save(note);
        log.info("Note id={} soft-deleted by seller id={}", noteId, sellerId);
    }

    /** Reads the page count from an uploaded PDF; 0 if it can't be parsed (non-fatal). */
    private int countPdfPages(MultipartFile pdf) {
        try (org.apache.pdfbox.pdmodel.PDDocument doc = org.apache.pdfbox.Loader.loadPDF(pdf.getBytes())) {
            return doc.getNumberOfPages();
        } catch (Exception e) {
            log.warn("Could not read page count from uploaded PDF: {}", e.getMessage());
            return 0;
        }
    }

    // ── Filters ───────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public Map<String, List<String>> getFilterOptions() {
        return Map.of(
                "categories", noteRepository.findDistinctActiveCategories(),
                "exams",      noteRepository.findDistinctActiveExams(),
                "subjects",   noteRepository.findDistinctActiveSubjects()
        );
    }

    // ── DTO mapping (public — reused by DashboardServiceImpl) ─

    @Override
    @Transactional(readOnly = true)
    public NoteResponse toResponse(Note note, Long viewerId) {
        boolean isPurchased = viewerId != null
                && purchaseRepository.existsByBuyerIdAndNoteId(viewerId, note.getId());

        User seller = note.getSeller();

        SellerPublicProfile sellerProfile = SellerPublicProfile.builder()
                .id(seller.getId())
                .fullName(seller.getFullName())
                .classLevel(seller.getClassLevel())
                .institution(seller.getInstitution())
                .bio(seller.getBio())
                .profileImageUrl(seller.getProfileImageUrl())
                .verified(Boolean.TRUE.equals(seller.getIsVerified()))
                .totalNotes(noteRepository.countBySellerId(seller.getId()))
                .build();

        return NoteResponse.builder()
                .id(note.getId())
                .title(note.getTitle())
                .description(note.getDescription())
                .level(note.getClassLevel())
                .category(note.getCategory())
                .exam(note.getExam())
                .subject(note.getSubject())
                .examType(note.getExamType())
                .price(note.getPrice())
                .thumbnailUrl(note.getThumbnailUrl())
                .previewUrl(note.getPreviewUrl())
                .totalPages(note.getTotalPages())
                .status(note.getStatus())
                .purchaseCount(note.getPurchaseCount())
                .viewCount(note.getViewCount())
                .averageRating(note.getAverageRating())
                .reviewCount(note.getReviewCount())
                .seller(sellerProfile)
                .createdAt(note.getCreatedAt())
                .isPurchased(isPurchased)
                .build();
    }

    // ── Private helpers ───────────────────────────────────────

    private User fetchUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));
    }

    private Note fetchSellerOwnedNote(Long noteId, Long sellerId) {
        Note note = noteRepository.findByIdAndSellerIdAndStatusNot(
                noteId, sellerId, NoteStatus.DELETED)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Note not found or you don't have permission to modify it"));
        return note;
    }
}

package com.topnotes.dto.response;

import com.topnotes.entity.enums.ExamType;
import com.topnotes.entity.enums.NoteStatus;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/** Note listing payload returned to buyers, sellers, and admin. */
@Getter
@Setter
@Builder
public class NoteResponse {
    private Long              id;
    private String            title;
    private String            description;
    /** Optional level/stage (maps to the legacy classLevel column). */
    private String            level;
    private String            category;
    private String            exam;
    private String            subject;
    /** Legacy enum — kept for backward compatibility; new clients use {@link #exam}. */
    private ExamType          examType;
    private BigDecimal        price;
    private String            thumbnailUrl;
    private String            previewUrl;
    private Integer           totalPages;
    private NoteStatus        status;
    /** True once an admin has approved the current content — gates the seller's "publish" action. */
    private Boolean           approved;
    private Integer           purchaseCount;
    private Integer           viewCount;
    private BigDecimal        averageRating;
    private Integer           reviewCount;
    private SellerPublicProfile seller;
    private LocalDateTime     createdAt;
    /** Context flag — true if requesting buyer has purchased this note. */
    private Boolean           isPurchased;

    // ── Seller-only analytics (populated by getSellerNotes; null elsewhere) ──
    /** Total seller-share earned by this note. */
    private BigDecimal        revenue;
    /** Date of the most recent sale. */
    private LocalDateTime     lastSoldAt;
    /** Median price of comparable active notes (same exam+subject) — for the underpriced nudge. */
    private BigDecimal        suggestedPrice;
    /** Daily sales counts over the last 30 days (oldest→newest) for a sparkline. */
    private List<Integer>     salesTrend;
    /** Admin's reason when REJECTED (seller-only) — so the seller knows what to fix. */
    private String            rejectionReason;
}

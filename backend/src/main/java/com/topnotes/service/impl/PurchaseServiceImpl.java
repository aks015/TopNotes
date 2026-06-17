package com.topnotes.service.impl;

import com.topnotes.dto.response.NoteResponse;
import com.topnotes.dto.response.PurchaseResponse;
import com.topnotes.entity.*;
import com.topnotes.entity.enums.NotificationType;
import com.topnotes.exception.BadRequestException;
import com.topnotes.exception.ResourceNotFoundException;
import com.topnotes.repository.*;
import com.topnotes.service.NotificationService;
import com.topnotes.service.NoteService;
import com.topnotes.service.PlatformConfigService;
import com.topnotes.service.PurchaseService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

@Service
@Slf4j
public class PurchaseServiceImpl implements PurchaseService {

    private final PurchaseRepository  purchaseRepository;
    private final NoteRepository      noteRepository;
    private final UserRepository      userRepository;
    private final EarningRepository   earningRepository;
    private final NotificationService notificationService;
    private final NoteService         noteService;
    private final PlatformConfigService platformConfigService;

    /** Default commission, seeded from properties; the live value is read from platform_config per sale. */
    @Value("${app.business.platform-commission-percent}")
    private int platformCommissionPercent;

    public PurchaseServiceImpl(PurchaseRepository purchaseRepository,
                               NoteRepository noteRepository,
                               UserRepository userRepository,
                               EarningRepository earningRepository,
                               NotificationService notificationService,
                               NoteService noteService,
                               PlatformConfigService platformConfigService) {
        this.purchaseRepository  = purchaseRepository;
        this.noteRepository      = noteRepository;
        this.userRepository      = userRepository;
        this.earningRepository   = earningRepository;
        this.notificationService = notificationService;
        this.noteService         = noteService;
        this.platformConfigService = platformConfigService;
    }

    @Override
    @Transactional
    public PurchaseResponse purchaseNote(Long noteId, Long buyerId) {
        return completePurchase(noteId, buyerId, generateTransactionId());
    }

    @Override
    @Transactional
    public PurchaseResponse purchaseNoteWithTransaction(Long noteId, Long buyerId, String transactionId) {
        return completePurchase(noteId, buyerId,
                (transactionId == null || transactionId.isBlank()) ? generateTransactionId() : transactionId);
    }

    private PurchaseResponse completePurchase(Long noteId, Long buyerId, String transactionId) {
        // Guard: already purchased?
        if (purchaseRepository.existsByBuyerIdAndNoteId(buyerId, noteId)) {
            throw new BadRequestException("You have already purchased this note");
        }

        Note note = noteRepository.findById(noteId)
                .orElseThrow(() -> new ResourceNotFoundException("Note", noteId));

        User buyer  = fetchUser(buyerId);
        User seller = note.getSeller();

        // Guard: buyer must not purchase their own note
        if (seller.getId().equals(buyerId)) {
            throw new BadRequestException("You cannot purchase your own note");
        }

        // ── Revenue split (live, admin-adjustable via platform_config) ─────────
        int commissionPercent = platformConfigService.getInt(
                "platform-commission-percent", platformCommissionPercent);
        BigDecimal amount        = note.getPrice();
        BigDecimal platformShare = amount
                .multiply(BigDecimal.valueOf(commissionPercent))
                .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        BigDecimal sellerShare   = amount.subtract(platformShare);

        // ── Persist purchase ───────────────────────────────────
        Purchase purchase = Purchase.builder()
                .buyer(buyer)
                .note(note)
                .seller(seller)
                .amount(amount)
                .platformShare(platformShare)
                .sellerShare(sellerShare)
                .transactionId(transactionId)
                .invoiceNumber(generateInvoiceNumber())
                .build();

        Purchase saved = purchaseRepository.save(purchase);

        // ── Persist earning ────────────────────────────────────
        Earning earning = Earning.builder()
                .seller(seller)
                .purchase(saved)
                .amount(sellerShare)
                .build();
        earningRepository.save(earning);

        // ── Update note stats ──────────────────────────────────
        note.setPurchaseCount(note.getPurchaseCount() + 1);
        noteRepository.save(note);

        // ── Notify seller ──────────────────────────────────────
        notificationService.createNotification(
                seller,
                "New Sale! 🎉",
                "Your note '" + note.getTitle() + "' was purchased. You earned ₹" + sellerShare,
                NotificationType.SALE);

        log.info("Purchase id={} completed: buyer={} note={} amount={}",
                saved.getId(), buyerId, noteId, amount);

        return toPurchaseResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<PurchaseResponse> getBuyerPurchases(Long buyerId, Pageable pageable) {
        return purchaseRepository
                .findByBuyerIdOrderByPurchasedAtDesc(buyerId, pageable)
                .map(this::toPurchaseResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<PurchaseResponse> getSellerSales(Long sellerId, Pageable pageable) {
        return purchaseRepository
                .findBySellerIdOrderByPurchasedAtDesc(sellerId, pageable)
                .map(this::toPurchaseResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean hasBuyerPurchasedNote(Long buyerId, Long noteId) {
        return purchaseRepository.existsByBuyerIdAndNoteId(buyerId, noteId);
    }

    // ── Private helpers ───────────────────────────────────────

    private User fetchUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));
    }

    private PurchaseResponse toPurchaseResponse(Purchase p) {
        NoteResponse noteResponse = noteService.toResponse(p.getNote(), p.getBuyer().getId());
        return PurchaseResponse.builder()
                .id(p.getId())
                .note(noteResponse)
                .amount(p.getAmount())
                .platformShare(p.getPlatformShare())
                .sellerShare(p.getSellerShare())
                .transactionId(p.getTransactionId())
                .invoiceNumber(p.getInvoiceNumber())
                .status(p.getStatus())
                .purchasedAt(p.getPurchasedAt())
                .build();
    }

    private String generateTransactionId() {
        return "TXN-" + UUID.randomUUID().toString().substring(0, 12).toUpperCase();
    }

    private String generateInvoiceNumber() {
        String date = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        return "INV-" + date + "-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase();
    }
}

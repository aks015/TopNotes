package com.topnotes.service.impl;

import com.topnotes.dto.response.PayoutResponse;
import com.topnotes.dto.response.PayoutStatsResponse;
import com.topnotes.dto.response.SellerEarningsResponse;
import com.topnotes.entity.PayoutRequest;
import com.topnotes.entity.User;
import com.topnotes.entity.enums.NotificationType;
import com.topnotes.entity.enums.PayoutStatus;
import com.topnotes.exception.BadRequestException;
import com.topnotes.exception.ResourceNotFoundException;
import com.topnotes.repository.EarningRepository;
import com.topnotes.repository.PayoutRepository;
import com.topnotes.repository.UserRepository;
import com.topnotes.service.NotificationService;
import com.topnotes.service.PayoutService;
import com.topnotes.service.PlatformConfigService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Service
@Slf4j
public class PayoutServiceImpl implements PayoutService {

    private final EarningRepository earningRepository;
    private final PayoutRepository payoutRepository;
    private final UserRepository userRepository;
    private final CashfreePayoutService cashfreePayoutService;
    private final NotificationService notificationService;
    private final PlatformConfigService platformConfigService;

    /** Default floor, seeded from properties; the live value is read from platform_config. */
    @Value("${app.business.min-withdraw:100}")
    private BigDecimal minWithdrawDefault;

    public PayoutServiceImpl(EarningRepository earningRepository,
                             PayoutRepository payoutRepository,
                             UserRepository userRepository,
                             CashfreePayoutService cashfreePayoutService,
                             NotificationService notificationService,
                             PlatformConfigService platformConfigService) {
        this.earningRepository = earningRepository;
        this.payoutRepository = payoutRepository;
        this.userRepository = userRepository;
        this.cashfreePayoutService = cashfreePayoutService;
        this.notificationService = notificationService;
        this.platformConfigService = platformConfigService;
    }

    /** Live minimum-withdrawal floor (admin-adjustable via platform_config). */
    private BigDecimal minWithdraw() {
        return platformConfigService.getDecimal("min-withdraw", minWithdrawDefault);
    }

    @Override
    public SellerEarningsResponse getEarnings(Long sellerId) {
        User seller = userRepository.findById(sellerId)
                .orElseThrow(() -> new ResourceNotFoundException("User", sellerId));

        BigDecimal earned     = earningRepository.sumTotalBySellerId(sellerId);
        BigDecimal paidOut    = payoutRepository.sumBySellerAndStatuses(sellerId, List.of(PayoutStatus.PAID));
        BigDecimal inProgress = payoutRepository.sumBySellerAndStatuses(sellerId, List.of(PayoutStatus.PENDING));
        BigDecimal available  = earned.subtract(paidOut).subtract(inProgress).max(BigDecimal.ZERO);

        return SellerEarningsResponse.builder()
                .totalEarned(earned)
                .paidOut(paidOut)
                .inProgress(inProgress)
                .available(available)
                .minWithdraw(minWithdraw())
                .upiSet(seller.getUpiId() != null && !seller.getUpiId().isBlank())
                .build();
    }

    @Override
    @Transactional
    public PayoutResponse requestPayout(Long sellerId) {
        User seller = userRepository.findById(sellerId)
                .orElseThrow(() -> new ResourceNotFoundException("User", sellerId));

        if (seller.getUpiId() == null || seller.getUpiId().isBlank()) {
            throw new BadRequestException("Add a payout UPI before requesting a withdrawal");
        }
        if (payoutRepository.existsBySellerIdAndStatus(sellerId, PayoutStatus.PENDING)) {
            throw new BadRequestException("You already have a pending payout request");
        }

        BigDecimal earned    = earningRepository.sumTotalBySellerId(sellerId);
        BigDecimal committed = payoutRepository.sumBySellerAndStatuses(
                sellerId, List.of(PayoutStatus.PENDING, PayoutStatus.PAID));
        BigDecimal available = earned.subtract(committed);

        BigDecimal minWithdraw = minWithdraw();
        if (available.compareTo(minWithdraw) < 0) {
            throw new BadRequestException("Minimum withdrawal is ₹" + minWithdraw.stripTrailingZeros().toPlainString());
        }

        PayoutRequest pr = PayoutRequest.builder()
                .seller(seller)
                .amount(available)
                .upiId(seller.getUpiId())
                .status(PayoutStatus.PENDING)
                .build();
        return toResponse(payoutRepository.save(pr));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<PayoutResponse> getPendingPayouts(Pageable pageable) {
        return payoutRepository.findByStatusOrderByRequestedAtAsc(PayoutStatus.PENDING, pageable)
                .map(this::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<PayoutResponse> getSellerPayouts(Long sellerId, Pageable pageable) {
        return payoutRepository.findBySellerIdOrderByRequestedAtDesc(sellerId, pageable)
                .map(this::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public PayoutStatsResponse getStats() {
        return PayoutStatsResponse.builder()
                .pendingCount(payoutRepository.countByStatus(PayoutStatus.PENDING))
                .pendingAmount(payoutRepository.sumByStatus(PayoutStatus.PENDING))
                .paidCount(payoutRepository.countByStatus(PayoutStatus.PAID))
                .paidAmount(payoutRepository.sumByStatus(PayoutStatus.PAID))
                .failedCount(payoutRepository.countByStatus(PayoutStatus.FAILED))
                .failedAmount(payoutRepository.sumByStatus(PayoutStatus.FAILED))
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public Page<PayoutResponse> getPayouts(PayoutStatus status, String keyword, Pageable pageable) {
        String kw = (keyword == null || keyword.isBlank()) ? null : keyword.trim();
        return payoutRepository.search(status, kw, pageable).map(this::toResponse);
    }

    @Override
    @Transactional
    public PayoutResponse payPayout(Long payoutId) {
        PayoutRequest pr = payoutRepository.findById(payoutId)
                .orElseThrow(() -> new ResourceNotFoundException("Payout", payoutId));

        if (pr.getStatus() != PayoutStatus.PENDING) {
            throw new BadRequestException("This payout is already " + pr.getStatus());
        }

        String transferId = "tnpo" + pr.getId() + "x" + System.currentTimeMillis();
        CashfreePayoutService.PayoutResult result = cashfreePayoutService.transferToUpi(
                transferId, pr.getSeller().getFullName(), pr.getSeller().getEmail(),
                pr.getSeller().getPhone(), pr.getUpiId(), pr.getAmount());

        if (result.success()) {
            pr.setStatus(PayoutStatus.PAID);
            pr.setReference(result.reference());
            pr.setPaidAt(LocalDateTime.now());
            notificationService.createNotification(pr.getSeller(), "Payout sent 💸",
                    "₹" + pr.getAmount() + " was sent to your UPI " + pr.getUpiId(),
                    NotificationType.PAYMENT);
            log.info("Payout id={} PAID ref={}", pr.getId(), result.reference());
        } else {
            pr.setStatus(PayoutStatus.FAILED);
            pr.setFailureReason(result.message());
            log.warn("Payout id={} FAILED: {}", pr.getId(), result.message());
        }
        return toResponse(payoutRepository.save(pr));
    }

    private PayoutResponse toResponse(PayoutRequest p) {
        return PayoutResponse.builder()
                .id(p.getId())
                .sellerId(p.getSeller().getId())
                .sellerName(p.getSeller().getFullName())
                .upiId(p.getUpiId())
                .amount(p.getAmount())
                .status(p.getStatus().name())
                .reference(p.getReference())
                .failureReason(p.getFailureReason())
                .requestedAt(p.getRequestedAt())
                .paidAt(p.getPaidAt())
                .build();
    }
}

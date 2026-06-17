package com.topnotes.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;

/**
 * Platform-wide payout KPIs for the admin payouts console: how much is awaiting
 * disbursement, how much has been paid out, and how many transfers failed.
 */
@Getter
@Builder
public class PayoutStatsResponse {
    private long pendingCount;
    private BigDecimal pendingAmount;
    private long paidCount;
    private BigDecimal paidAmount;
    private long failedCount;
    private BigDecimal failedAmount;
}

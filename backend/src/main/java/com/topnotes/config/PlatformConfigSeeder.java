package com.topnotes.config;

import com.topnotes.entity.PlatformConfig;
import com.topnotes.repository.PlatformConfigRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

/**
 * Seeds the runtime-adjustable settings into {@code platform_config} from the
 * {@code application.properties} defaults, so the admin Platform Config page shows
 * the true effective values on first load (and the purchase/payout flows have a
 * live, editable source of truth). Idempotent: only inserts missing keys, never
 * overwrites a value an admin has already changed.
 */
@Component
@Order(40)
@Slf4j
public class PlatformConfigSeeder implements CommandLineRunner {

    private final PlatformConfigRepository repo;

    @Value("${app.business.platform-commission-percent}")
    private int platformCommission;

    @Value("${app.business.min-withdraw:100}")
    private BigDecimal minWithdraw;

    public PlatformConfigSeeder(PlatformConfigRepository repo) {
        this.repo = repo;
    }

    @Override
    @Transactional
    public void run(String... args) {
        int seeded = 0;
        seeded += seed("platform-commission-percent", String.valueOf(platformCommission),
                "Platform's cut of each sale, in percent. The seller keeps the rest.");
        seeded += seed("seller-commission-percent", String.valueOf(100 - platformCommission),
                "Seller's share of each sale, in percent (derived from the platform cut).");
        seeded += seed("min-withdraw", minWithdraw.stripTrailingZeros().toPlainString(),
                "Minimum available balance (₹) a seller needs before they can request a withdrawal.");
        if (seeded > 0) log.info("Seeded {} platform_config defaults.", seeded);
    }

    private int seed(String key, String value, String description) {
        if (repo.findByConfigKey(key).isPresent()) return 0;
        repo.save(PlatformConfig.builder()
                .configKey(key)
                .configValue(value)
                .description(description)
                .build());
        return 1;
    }
}

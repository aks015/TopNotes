package com.topnotes.service.impl;

import com.topnotes.repository.PlatformConfigRepository;
import com.topnotes.service.PlatformConfigService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

@Service
@Slf4j
public class PlatformConfigServiceImpl implements PlatformConfigService {

    private final PlatformConfigRepository repo;

    public PlatformConfigServiceImpl(PlatformConfigRepository repo) {
        this.repo = repo;
    }

    @Override
    @Transactional(readOnly = true)
    public int getInt(String key, int fallback) {
        String raw = raw(key);
        if (raw == null) return fallback;
        try {
            return Integer.parseInt(raw.trim());
        } catch (NumberFormatException e) {
            log.warn("Config key '{}' = '{}' is not an int; using fallback {}", key, raw, fallback);
            return fallback;
        }
    }

    @Override
    @Transactional(readOnly = true)
    public BigDecimal getDecimal(String key, BigDecimal fallback) {
        String raw = raw(key);
        if (raw == null) return fallback;
        try {
            return new BigDecimal(raw.trim());
        } catch (NumberFormatException e) {
            log.warn("Config key '{}' = '{}' is not a number; using fallback {}", key, raw, fallback);
            return fallback;
        }
    }

    @Override
    @Transactional(readOnly = true)
    public String getString(String key, String fallback) {
        String raw = raw(key);
        return raw == null ? fallback : raw;
    }

    private String raw(String key) {
        return repo.findByConfigKey(key)
                .map(c -> c.getConfigValue())
                .filter(v -> v != null && !v.isBlank())
                .orElse(null);
    }
}

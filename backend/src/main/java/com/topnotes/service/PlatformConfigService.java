package com.topnotes.service;

import java.math.BigDecimal;

/**
 * Reads runtime-adjustable settings from the {@code platform_config} table so
 * admin edits take effect without a restart. Each getter falls back to a
 * supplied default (typically the {@code application.properties} seed value)
 * when the key is missing or unparseable, so the platform never breaks on a
 * bad/absent config row.
 */
public interface PlatformConfigService {

    int getInt(String key, int fallback);

    BigDecimal getDecimal(String key, BigDecimal fallback);

    String getString(String key, String fallback);
}

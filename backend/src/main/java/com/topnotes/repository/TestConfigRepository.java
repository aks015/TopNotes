package com.topnotes.repository;

import com.topnotes.entity.TestConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Only ONE row of TestConfig is ever used.
 * findFirstBy() implements the singleton pattern —
 * if no row exists, the service creates a default one.
 */
@Repository
public interface TestConfigRepository extends JpaRepository<TestConfig, Long> {
    Optional<TestConfig> findFirstByOrderByIdAsc();

    /** Per-category config row, if one exists. */
    Optional<TestConfig> findByCategoryId(Long categoryId);

    /** The global "Default" config (category_id IS NULL). */
    Optional<TestConfig> findByCategoryIsNull();
}

package com.topnotes.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

/** Full test configuration — returned to admin and used by seller test page. */
@Getter @Builder
public class TestConfigResponse {
    private Long    id;
    /** Category this config is for. null = the global Default config. */
    private Long    categoryId;
    private String  categoryName;
    private Integer passScorePercent;
    private Integer timeLimitMinutes;
    private Integer maxAttempts;
    private Integer questionsPerTest;
    private Boolean shuffleQuestions;
    private Boolean shuffleOptions;
    private Boolean isActive;
    private Integer totalActiveQuestions;  // convenience count for admin UI
    private LocalDateTime updatedAt;
}

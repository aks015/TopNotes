package com.topnotes.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

/**
 * Admin creates or updates a question with all its options in one request.
 * The correct answer key is included here (admin-only DTO — never returned to sellers).
 */
@Getter @Setter
public class TestQuestionRequest {

    @NotBlank(message = "Question text is required")
    @Size(min = 10, max = 2000, message = "Question text must be between 10 and 2000 characters")
    private String questionText;

    @Size(max = 100, message = "Subject must not exceed 100 characters")
    private String subject;

    /** Exam-category pool this question belongs to. NULL = the shared "General" pool. */
    private Long categoryId;

    private Integer displayOrder;

    private Boolean isActive = true;

    @NotNull(message = "Options are required")
    @Size(min = 2, max = 6, message = "A question must have between 2 and 6 options")
    @Valid
    private List<TestOptionRequest> options;

    @NotBlank(message = "Correct answer key is required")
    @Pattern(regexp = "^[A-F]$", message = "Correct answer key must be a single letter A–F")
    private String correctAnswerKey;

    // Inner DTO
    @Getter @Setter
    public static class TestOptionRequest {
        @NotBlank(message = "Option key is required")
        @Pattern(regexp = "^[A-F]$", message = "Option key must be A–F")
        private String optionKey;

        @NotBlank(message = "Option text is required")
        @Size(min = 1, max = 1000, message = "Option text must not exceed 1000 characters")
        private String optionText;
    }
}

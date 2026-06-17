package com.topnotes.dto.request;

import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

/** Payload (JSON part of multipart) for editing an existing note (PUT /notes/{id}). */
@Getter
@Setter
public class NoteUpdateRequest {

    @NotBlank(message = "Title is required")
    @Size(min = 5, max = 250, message = "Title must be between 5 and 250 characters")
    private String title;

    @NotBlank(message = "Description is required")
    @Size(min = 20, max = 5000, message = "Description must be between 20 and 5000 characters")
    private String description;

    @NotBlank(message = "Exam category is required")
    @Size(max = 100)
    private String category;

    @NotBlank(message = "Exam is required")
    @Size(max = 120)
    private String exam;

    @NotBlank(message = "Subject is required")
    @Size(max = 120)
    private String subject;

    @Size(max = 60)
    private String level;

    @NotNull(message = "Price is required")
    @DecimalMin(value = "1.00", message = "Price must be at least ₹1")
    @DecimalMax(value = "99999.99", message = "Price must not exceed ₹99,999")
    @Digits(integer = 7, fraction = 2)
    private BigDecimal price;
}

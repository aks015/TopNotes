package com.topnotes.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

/** Create/rename payload for a taxonomy node (category, exam, or subject). */
@Getter
@Setter
public class TaxonomyNameRequest {

    @NotBlank(message = "Name is required")
    @Size(min = 1, max = 120, message = "Name must be between 1 and 120 characters")
    private String name;

    /** Optional sort position; defaults to end of list when null. */
    private Integer displayOrder;

    /** Optional active flag (admin can disable without deleting). */
    private Boolean active;
}

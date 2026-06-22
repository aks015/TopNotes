package com.topnotes.dto.request;

import lombok.Getter;
import lombok.Setter;

/** Admin decision on a pending note. */
@Getter
@Setter
public class NoteReviewRequest {
    private boolean approved;
    /** Required when rejecting — shown to the seller. */
    private String reason;
}

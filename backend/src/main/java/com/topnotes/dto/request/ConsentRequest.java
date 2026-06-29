package com.topnotes.dto.request;

import com.topnotes.entity.enums.AgreementType;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

/** Payload for POST /consent — records acceptance of the active agreement of {@code type}. */
@Getter
@Setter
public class ConsentRequest {

    @NotNull(message = "Agreement type is required")
    private AgreementType type;

    /** Optional — the note an originality declaration pertains to. */
    private Long noteId;
}

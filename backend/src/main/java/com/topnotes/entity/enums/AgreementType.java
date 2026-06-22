package com.topnotes.entity.enums;

/** Legal agreements a user can be asked to accept. */
public enum AgreementType {
    /** One-time (re-prompted on version bump) platform seller agreement. */
    SELLER_AGREEMENT,
    /** Per-upload declaration that the uploaded notes are the seller's own original work. */
    ORIGINALITY_DECLARATION
}

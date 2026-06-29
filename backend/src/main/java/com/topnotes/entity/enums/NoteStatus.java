package com.topnotes.entity.enums;

/** Publication status of a note listing. */
public enum NoteStatus {
    /** Submitted by the seller, awaiting admin content review (not visible to buyers). */
    PENDING_REVIEW,
    /** Admin rejected the content (not visible to buyers); seller can edit & resubmit. */
    REJECTED,
    /** Approved & live in the marketplace. */
    ACTIVE,
    /** Hidden by the seller/admin (e.g. qualification revoked). */
    INACTIVE,
    DELETED
}

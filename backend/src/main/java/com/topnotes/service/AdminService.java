package com.topnotes.service;

import com.topnotes.dto.request.ConfigUpdateRequest;
import com.topnotes.dto.response.NoteResponse;
import com.topnotes.dto.response.PendingNoteResponse;
import com.topnotes.dto.response.UserResponse;
import com.topnotes.entity.enums.UserRole;
import com.topnotes.entity.enums.UserStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.Map;

/** Admin-only user management and platform configuration. */
public interface AdminService {
    Page<UserResponse>       getUsers(UserRole roleFilter, UserStatus statusFilter, String keyword, Pageable pageable);
    UserResponse             getUserById(Long id);
    UserResponse             suspendUser(Long id);
    UserResponse             activateUser(Long id);
    Page<UserResponse>       getPendingVerifications(Pageable pageable);
    Map<String, String>      getAllConfig();
    void                     updateConfig(ConfigUpdateRequest request);
    Page<NoteResponse>       getAllNotes(Pageable pageable);

    /** Notes awaiting admin content review (the seller's own original-work check). */
    Page<PendingNoteResponse> getPendingNotes(Pageable pageable);

    /** Approve (→ live) or reject (→ needs changes) a pending note; notifies the seller. */
    void                     reviewNote(Long noteId, boolean approved, String reason);
}

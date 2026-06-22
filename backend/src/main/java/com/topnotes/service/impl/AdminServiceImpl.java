package com.topnotes.service.impl;

import com.topnotes.dto.request.ConfigUpdateRequest;
import com.topnotes.dto.response.NoteResponse;
import com.topnotes.dto.response.PendingNoteResponse;
import com.topnotes.dto.response.UserResponse;
import com.topnotes.entity.Note;
import com.topnotes.entity.PlatformConfig;
import com.topnotes.entity.User;
import com.topnotes.entity.enums.NoteStatus;
import com.topnotes.entity.enums.NotificationType;
import com.topnotes.entity.enums.UserRole;
import com.topnotes.entity.enums.UserStatus;
import com.topnotes.exception.BadRequestException;
import com.topnotes.exception.ResourceNotFoundException;
import com.topnotes.repository.NoteRepository;
import com.topnotes.repository.PlatformConfigRepository;
import com.topnotes.repository.UserRepository;
import com.topnotes.service.AdminService;
import com.topnotes.service.NoteService;
import com.topnotes.service.NotificationService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.stream.Collectors;

@Service
@Slf4j
public class AdminServiceImpl implements AdminService {

    private final UserRepository           userRepository;
    private final NoteRepository           noteRepository;
    private final PlatformConfigRepository configRepository;
    private final NoteService              noteService;
    private final NotificationService      notificationService;

    public AdminServiceImpl(UserRepository userRepository,
                            NoteRepository noteRepository,
                            PlatformConfigRepository configRepository,
                            NoteService noteService,
                            NotificationService notificationService) {
        this.userRepository   = userRepository;
        this.noteRepository   = noteRepository;
        this.configRepository = configRepository;
        this.noteService      = noteService;
        this.notificationService = notificationService;
    }

    // ── Note content review ───────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public Page<PendingNoteResponse> getPendingNotes(Pageable pageable) {
        return noteRepository.findByStatus(NoteStatus.PENDING_REVIEW, pageable).map(n -> {
            User s = n.getSeller();
            return new PendingNoteResponse(n.getId(), n.getTitle(), n.getDescription(),
                    n.getCategory(), n.getExam(), n.getSubject(), n.getClassLevel(),
                    n.getPrice(), n.getThumbnailUrl(), n.getPdfUrl(), n.getTotalPages(),
                    s.getId(), s.getFullName(), s.getEmail(), n.getCreatedAt());
        });
    }

    @Override
    @Transactional
    public void reviewNote(Long noteId, boolean approved, String reason) {
        Note note = noteRepository.findById(noteId)
                .orElseThrow(() -> new ResourceNotFoundException("Note", noteId));
        if (note.getStatus() != NoteStatus.PENDING_REVIEW) {
            throw new BadRequestException("This note isn't pending review.");
        }
        if (!approved && (reason == null || reason.isBlank())) {
            throw new BadRequestException("A reason is required when rejecting a note.");
        }
        note.setStatus(approved ? NoteStatus.ACTIVE : NoteStatus.REJECTED);
        // Mark the current content as admin-approved so the seller may hide/republish it
        // later without re-review. Any future content change resets this (see NoteServiceImpl).
        if (approved) {
            note.setApproved(true);
            note.setRejectionReason(null);
        } else {
            note.setRejectionReason(reason);
        }
        noteRepository.save(note);

        notificationService.createNotification(note.getSeller(),
                approved ? "Notes approved & live 🎉" : "Notes need changes",
                approved
                        ? "Your notes \"" + note.getTitle() + "\" passed review and are now live on TopNotes."
                        : "Your notes \"" + note.getTitle() + "\" weren't approved. Reason: " + reason,
                NotificationType.SYSTEM);
        log.info("Note {} review: approved={}", noteId, approved);
    }

    // ── User management ───────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public Page<UserResponse> getUsers(UserRole roleFilter, UserStatus statusFilter, String keyword, Pageable pageable) {
        String kw = keyword == null ? "" : keyword.trim().toLowerCase();
        boolean allRole = roleFilter == null;
        boolean allStatus = statusFilter == null;
        return userRepository
                .searchUsers(allRole, allRole ? UserRole.BUYER : roleFilter,
                             allStatus, allStatus ? UserStatus.ACTIVE : statusFilter,
                             kw, pageable)
                .map(this::toUserResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public UserResponse getUserById(Long id) {
        return toUserResponse(fetchUser(id));
    }

    @Override
    @Transactional
    public UserResponse suspendUser(Long id) {
        User user = fetchUser(id);
        if (user.getRole() == UserRole.ADMIN) {
            throw new BadRequestException("Cannot suspend an admin account");
        }
        user.setStatus(UserStatus.SUSPENDED);
        log.info("User id={} suspended", id);
        return toUserResponse(userRepository.save(user));
    }

    @Override
    @Transactional
    public UserResponse activateUser(Long id) {
        User user = fetchUser(id);
        user.setStatus(UserStatus.ACTIVE);
        log.info("User id={} activated", id);
        return toUserResponse(userRepository.save(user));
    }

    // ── Verifications ─────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public Page<UserResponse> getPendingVerifications(Pageable pageable) {
        return userRepository.findPendingSellerApprovals(pageable)
                .map(this::toUserResponse);
    }

    // ── Platform config ───────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public Map<String, String> getAllConfig() {
        return configRepository.findAll().stream()
                .collect(Collectors.toMap(
                        PlatformConfig::getConfigKey,
                        PlatformConfig::getConfigValue));
    }

    @Override
    @Transactional
    public void updateConfig(ConfigUpdateRequest request) {
        PlatformConfig config = configRepository
                .findByConfigKey(request.getConfigKey())
                .orElse(PlatformConfig.builder()
                        .configKey(request.getConfigKey())
                        .build());

        config.setConfigValue(request.getConfigValue());
        if (request.getDescription() != null) {
            config.setDescription(request.getDescription());
        }
        configRepository.save(config);
        log.info("Config updated: key={} value={}", request.getConfigKey(), request.getConfigValue());
    }

    // ── Notes admin view ──────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public Page<NoteResponse> getAllNotes(Pageable pageable) {
        return noteRepository.findByStatus(NoteStatus.ACTIVE, pageable)
                .map(n -> noteService.toResponse(n, null));
    }

    // ── Helpers ───────────────────────────────────────────────

    private User fetchUser(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", id));
    }

    private UserResponse toUserResponse(User u) {
        return UserResponse.builder()
                .id(u.getId())
                .email(u.getEmail())
                .fullName(u.getFullName())
                .phone(u.getPhone())
                .role(u.getRole())
                .status(u.getStatus())
                .profileImageUrl(u.getProfileImageUrl())
                .classLevel(u.getClassLevel())
                .institution(u.getInstitution())
                .bio(u.getBio())
                .isVerified(u.getIsVerified())
                .testPassed(u.getTestPassed())
                .testScore(u.getTestScore())
                .marksheetApproved(u.getMarksheetApproved())
                .marksheetUrl(u.getMarksheetUrl())
                .createdAt(u.getCreatedAt())
                .build();
    }
}

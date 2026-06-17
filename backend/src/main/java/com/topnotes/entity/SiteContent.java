package com.topnotes.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Admin-editable site content (CMS). One row per page, e.g. "landing".
 * The whole page config is stored as a JSON string so admins can edit every
 * section without a schema change / redeploy.
 */
@Entity
@Table(name = "site_content")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class SiteContent {

    @Id
    @Column(length = 50)
    private String pageKey;

    @Column(columnDefinition = "TEXT")
    private String content;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}

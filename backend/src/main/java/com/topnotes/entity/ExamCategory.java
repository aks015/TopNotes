package com.topnotes.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

/**
 * Top level of the exam taxonomy (e.g. "Engineering", "Civil Services",
 * "Banking"). Admin-managed so new exam families can be added without a
 * redeploy. Notes store the chosen names denormalised, so deleting/renaming a
 * taxonomy entry never breaks existing listings.
 */
@Entity
@Table(name = "exam_categories")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExamCategory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 100)
    private String name;

    @Column(nullable = false)
    @Builder.Default
    private Integer displayOrder = 0;

    @Column(nullable = false)
    @Builder.Default
    private Boolean active = true;

    @OneToMany(mappedBy = "category", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("displayOrder ASC, name ASC")
    @Builder.Default
    private List<Exam> exams = new ArrayList<>();
}

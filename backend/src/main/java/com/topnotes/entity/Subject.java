package com.topnotes.entity;

import jakarta.persistence.*;
import lombok.*;

/** A subject offered under a specific exam (e.g. "Polity" under "UPSC CSE"). */
@Entity
@Table(name = "subjects", uniqueConstraints = @UniqueConstraint(columnNames = {"exam_id", "name"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Subject {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "exam_id", nullable = false)
    private Exam exam;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(nullable = false)
    @Builder.Default
    private Integer displayOrder = 0;

    @Column(nullable = false)
    @Builder.Default
    private Boolean active = true;
}

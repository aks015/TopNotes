package com.topnotes.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

/** A specific exam within a category (e.g. "UPSC CSE", "JEE Main", "IBPS PO"). */
@Entity
@Table(name = "exams", uniqueConstraints = @UniqueConstraint(columnNames = {"category_id", "name"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Exam {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id", nullable = false)
    private ExamCategory category;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(nullable = false)
    @Builder.Default
    private Integer displayOrder = 0;

    @Column(nullable = false)
    @Builder.Default
    private Boolean active = true;

    @OneToMany(mappedBy = "exam", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("displayOrder ASC, name ASC")
    @Builder.Default
    private List<Subject> subjects = new ArrayList<>();
}

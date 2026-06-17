package com.topnotes.repository;

import com.topnotes.entity.Exam;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ExamRepository extends JpaRepository<Exam, Long> {

    boolean existsByCategoryIdAndNameIgnoreCase(Long categoryId, String name);

    Optional<Exam> findByNameIgnoreCase(String name);

    /** Resolve an exam by (category, name) — used to validate the note's taxonomy triple. */
    Optional<Exam> findByCategoryIdAndNameIgnoreCase(Long categoryId, String name);
}

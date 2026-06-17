package com.topnotes.repository;

import com.topnotes.entity.ExamCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ExamCategoryRepository extends JpaRepository<ExamCategory, Long> {

    List<ExamCategory> findAllByOrderByDisplayOrderAscNameAsc();

    boolean existsByNameIgnoreCase(String name);

    Optional<ExamCategory> findByNameIgnoreCase(String name);

    long count();
}

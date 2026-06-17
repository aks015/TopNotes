package com.topnotes.repository;

import com.topnotes.entity.Subject;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SubjectRepository extends JpaRepository<Subject, Long> {

    boolean existsByExamIdAndNameIgnoreCase(Long examId, String name);
}

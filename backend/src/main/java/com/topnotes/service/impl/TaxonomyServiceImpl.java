package com.topnotes.service.impl;

import com.topnotes.dto.request.TaxonomyNameRequest;
import com.topnotes.dto.response.TaxonomyResponse;
import com.topnotes.dto.response.TaxonomyResponse.CategoryNode;
import com.topnotes.dto.response.TaxonomyResponse.ExamNode;
import com.topnotes.dto.response.TaxonomyResponse.SubjectNode;
import com.topnotes.entity.Exam;
import com.topnotes.entity.ExamCategory;
import com.topnotes.entity.Subject;
import com.topnotes.exception.BadRequestException;
import com.topnotes.exception.ResourceNotFoundException;
import com.topnotes.repository.ExamCategoryRepository;
import com.topnotes.repository.ExamRepository;
import com.topnotes.repository.SubjectRepository;
import com.topnotes.service.TaxonomyService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;

@Service
@Slf4j
public class TaxonomyServiceImpl implements TaxonomyService {

    private final ExamCategoryRepository categoryRepository;
    private final ExamRepository         examRepository;
    private final SubjectRepository      subjectRepository;

    public TaxonomyServiceImpl(ExamCategoryRepository categoryRepository,
                               ExamRepository examRepository,
                               SubjectRepository subjectRepository) {
        this.categoryRepository = categoryRepository;
        this.examRepository     = examRepository;
        this.subjectRepository  = subjectRepository;
    }

    // ── Reads ─────────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public TaxonomyResponse getPublicTaxonomy() {
        return build(true);
    }

    @Override
    @Transactional(readOnly = true)
    public TaxonomyResponse getFullTaxonomy() {
        return build(false);
    }

    private TaxonomyResponse build(boolean activeOnly) {
        List<CategoryNode> categories = categoryRepository.findAllByOrderByDisplayOrderAscNameAsc().stream()
                .filter(c -> !activeOnly || Boolean.TRUE.equals(c.getActive()))
                .map(c -> new CategoryNode(
                        c.getId(), c.getName(), Boolean.TRUE.equals(c.getActive()),
                        c.getExams().stream()
                                .filter(e -> !activeOnly || Boolean.TRUE.equals(e.getActive()))
                                .sorted(orderThenName())
                                .map(e -> new ExamNode(
                                        e.getId(), e.getName(), Boolean.TRUE.equals(e.getActive()),
                                        e.getSubjects().stream()
                                                .filter(s -> !activeOnly || Boolean.TRUE.equals(s.getActive()))
                                                .sorted(subjectOrder())
                                                .map(s -> new SubjectNode(s.getId(), s.getName(), Boolean.TRUE.equals(s.getActive())))
                                                .toList()))
                                .toList()))
                .toList();
        return new TaxonomyResponse(categories);
    }

    private Comparator<Exam> orderThenName() {
        return Comparator.comparing(Exam::getDisplayOrder, Comparator.nullsLast(Integer::compareTo))
                .thenComparing(Exam::getName, String.CASE_INSENSITIVE_ORDER);
    }

    private Comparator<Subject> subjectOrder() {
        return Comparator.comparing(Subject::getDisplayOrder, Comparator.nullsLast(Integer::compareTo))
                .thenComparing(Subject::getName, String.CASE_INSENSITIVE_ORDER);
    }

    // ── Category ──────────────────────────────────────────────

    @Override
    @Transactional
    public TaxonomyResponse createCategory(TaxonomyNameRequest req) {
        String name = clean(req.getName());
        if (categoryRepository.existsByNameIgnoreCase(name)) {
            throw new BadRequestException("A category named '" + name + "' already exists");
        }
        categoryRepository.save(ExamCategory.builder()
                .name(name)
                .displayOrder(req.getDisplayOrder() != null ? req.getDisplayOrder() : nextOrder())
                .active(req.getActive() == null || req.getActive())
                .build());
        return getFullTaxonomy();
    }

    @Override
    @Transactional
    public TaxonomyResponse updateCategory(Long id, TaxonomyNameRequest req) {
        ExamCategory c = categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Category", id));
        applyName(req, c::getName, c::setName,
                name -> categoryRepository.existsByNameIgnoreCase(name) && !name.equalsIgnoreCase(c.getName()));
        if (req.getDisplayOrder() != null) c.setDisplayOrder(req.getDisplayOrder());
        if (req.getActive() != null) c.setActive(req.getActive());
        categoryRepository.save(c);
        return getFullTaxonomy();
    }

    @Override
    @Transactional
    public TaxonomyResponse deleteCategory(Long id) {
        if (!categoryRepository.existsById(id)) throw new ResourceNotFoundException("Category", id);
        categoryRepository.deleteById(id);   // cascades to exams + subjects; notes keep their stored strings
        return getFullTaxonomy();
    }

    // ── Exam ──────────────────────────────────────────────────

    @Override
    @Transactional
    public TaxonomyResponse createExam(Long categoryId, TaxonomyNameRequest req) {
        ExamCategory cat = categoryRepository.findById(categoryId)
                .orElseThrow(() -> new ResourceNotFoundException("Category", categoryId));
        String name = clean(req.getName());
        if (examRepository.existsByCategoryIdAndNameIgnoreCase(categoryId, name)) {
            throw new BadRequestException("An exam named '" + name + "' already exists in this category");
        }
        examRepository.save(Exam.builder()
                .category(cat)
                .name(name)
                .displayOrder(req.getDisplayOrder() != null ? req.getDisplayOrder() : 0)
                .active(req.getActive() == null || req.getActive())
                .build());
        return getFullTaxonomy();
    }

    @Override
    @Transactional
    public TaxonomyResponse updateExam(Long id, TaxonomyNameRequest req) {
        Exam e = examRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Exam", id));
        applyName(req, e::getName, e::setName,
                name -> examRepository.existsByCategoryIdAndNameIgnoreCase(e.getCategory().getId(), name)
                        && !name.equalsIgnoreCase(e.getName()));
        if (req.getDisplayOrder() != null) e.setDisplayOrder(req.getDisplayOrder());
        if (req.getActive() != null) e.setActive(req.getActive());
        examRepository.save(e);
        return getFullTaxonomy();
    }

    @Override
    @Transactional
    public TaxonomyResponse deleteExam(Long id) {
        if (!examRepository.existsById(id)) throw new ResourceNotFoundException("Exam", id);
        examRepository.deleteById(id);
        return getFullTaxonomy();
    }

    // ── Subject ───────────────────────────────────────────────

    @Override
    @Transactional
    public TaxonomyResponse createSubject(Long examId, TaxonomyNameRequest req) {
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam", examId));
        String name = clean(req.getName());
        if (subjectRepository.existsByExamIdAndNameIgnoreCase(examId, name)) {
            throw new BadRequestException("A subject named '" + name + "' already exists for this exam");
        }
        subjectRepository.save(Subject.builder()
                .exam(exam)
                .name(name)
                .displayOrder(req.getDisplayOrder() != null ? req.getDisplayOrder() : 0)
                .active(req.getActive() == null || req.getActive())
                .build());
        return getFullTaxonomy();
    }

    @Override
    @Transactional
    public TaxonomyResponse updateSubject(Long id, TaxonomyNameRequest req) {
        Subject s = subjectRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Subject", id));
        applyName(req, s::getName, s::setName,
                name -> subjectRepository.existsByExamIdAndNameIgnoreCase(s.getExam().getId(), name)
                        && !name.equalsIgnoreCase(s.getName()));
        if (req.getDisplayOrder() != null) s.setDisplayOrder(req.getDisplayOrder());
        if (req.getActive() != null) s.setActive(req.getActive());
        subjectRepository.save(s);
        return getFullTaxonomy();
    }

    @Override
    @Transactional
    public TaxonomyResponse deleteSubject(Long id) {
        if (!subjectRepository.existsById(id)) throw new ResourceNotFoundException("Subject", id);
        subjectRepository.deleteById(id);
        return getFullTaxonomy();
    }

    // ── Helpers ───────────────────────────────────────────────

    private String clean(String s) {
        return s == null ? "" : s.trim();
    }

    private int nextOrder() {
        return (int) categoryRepository.count();
    }

    private void applyName(TaxonomyNameRequest req,
                           java.util.function.Supplier<String> getter,
                           java.util.function.Consumer<String> setter,
                           java.util.function.Predicate<String> duplicate) {
        if (req.getName() == null) return;
        String name = clean(req.getName());
        if (name.isEmpty()) throw new BadRequestException("Name cannot be blank");
        if (!name.equals(getter.get()) && duplicate.test(name)) {
            throw new BadRequestException("'" + name + "' already exists");
        }
        setter.accept(name);
    }
}

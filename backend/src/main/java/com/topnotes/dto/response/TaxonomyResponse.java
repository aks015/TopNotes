package com.topnotes.dto.response;

import java.util.List;

/**
 * Nested exam taxonomy for the upload cascade and admin manager:
 * Category → Exam → Subject. {@code active} is included so the admin manager
 * can show/toggle disabled entries; the public endpoint only returns active ones.
 */
public record TaxonomyResponse(List<CategoryNode> categories) {

    public record CategoryNode(Long id, String name, boolean active, List<ExamNode> exams) {}

    public record ExamNode(Long id, String name, boolean active, List<SubjectNode> subjects) {}

    public record SubjectNode(Long id, String name, boolean active) {}
}

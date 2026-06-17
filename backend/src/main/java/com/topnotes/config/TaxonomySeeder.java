package com.topnotes.config;

import com.topnotes.entity.Exam;
import com.topnotes.entity.ExamCategory;
import com.topnotes.entity.Subject;
import com.topnotes.repository.ExamCategoryRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/**
 * Seeds a broad default taxonomy of Indian competitive/school exams the first
 * time the app boots against an empty taxonomy. Admins can then add/edit/remove
 * entries from the Taxonomy manager — this only runs when no categories exist.
 */
@Component
@Order(20)
@Slf4j
public class TaxonomySeeder implements CommandLineRunner {

    private final ExamCategoryRepository categoryRepository;

    public TaxonomySeeder(ExamCategoryRepository categoryRepository) {
        this.categoryRepository = categoryRepository;
    }

    private record Ex(String name, String... subjects) {}
    private record Cat(String name, Ex... exams) {}

    @Override
    @Transactional
    public void run(String... args) {
        if (categoryRepository.count() > 0) return;
        log.info("Seeding default exam taxonomy…");

        Cat[] data = {
            new Cat("Engineering",
                new Ex("JEE Main", "Physics", "Chemistry", "Mathematics"),
                new Ex("JEE Advanced", "Physics", "Chemistry", "Mathematics"),
                new Ex("BITSAT", "Physics", "Chemistry", "Mathematics", "English", "Logical Reasoning"),
                new Ex("GATE", "General Aptitude", "Engineering Mathematics", "Core Subject"),
                new Ex("State CET", "Physics", "Chemistry", "Mathematics", "Biology")),
            new Cat("Medical",
                new Ex("NEET UG", "Physics", "Chemistry", "Biology"),
                new Ex("NEET PG", "General Medicine", "Surgery", "Pediatrics", "Anatomy", "Physiology"),
                new Ex("INI-CET / AIIMS", "Anatomy", "Physiology", "Biochemistry", "Pathology", "Pharmacology")),
            new Cat("Civil Services",
                new Ex("UPSC CSE", "Polity", "History", "Geography", "Economics", "Environment",
                        "Science & Technology", "Current Affairs", "CSAT", "Ethics", "Optional Subject"),
                new Ex("State PSC", "Polity", "History", "Geography", "Economics", "State GK", "Current Affairs")),
            new Cat("Banking & Insurance",
                new Ex("IBPS PO", "Quantitative Aptitude", "Reasoning", "English", "General Awareness", "Computer Aptitude"),
                new Ex("IBPS Clerk", "Quantitative Aptitude", "Reasoning", "English", "General Awareness"),
                new Ex("SBI PO", "Quantitative Aptitude", "Reasoning", "English", "General Awareness", "Computer Aptitude"),
                new Ex("SBI Clerk", "Quantitative Aptitude", "Reasoning", "English", "General Awareness"),
                new Ex("RBI Grade B", "Economic & Social Issues", "Finance & Management", "English", "Quantitative Aptitude", "Reasoning")),
            new Cat("SSC & Railways",
                new Ex("SSC CGL", "Quantitative Aptitude", "Reasoning", "English", "General Awareness"),
                new Ex("SSC CHSL", "Quantitative Aptitude", "Reasoning", "English", "General Awareness"),
                new Ex("SSC GD", "Elementary Mathematics", "Reasoning", "General Knowledge", "English / Hindi"),
                new Ex("RRB NTPC", "Mathematics", "General Intelligence & Reasoning", "General Awareness")),
            new Cat("Defence",
                new Ex("NDA", "Mathematics", "General Ability Test", "English", "General Knowledge"),
                new Ex("CDS", "English", "General Knowledge", "Elementary Mathematics"),
                new Ex("AFCAT", "General Awareness", "Verbal Ability", "Numerical Ability", "Reasoning & Military Aptitude"),
                new Ex("CAPF AC", "General Studies", "General Aptitude", "Essay & Comprehension")),
            new Cat("Commerce & Accountancy",
                new Ex("CA Foundation", "Accounting", "Business Laws", "Quantitative Aptitude", "Business Economics"),
                new Ex("CA Intermediate", "Advanced Accounting", "Corporate Laws", "Taxation", "Cost Accounting", "Auditing", "Financial Management"),
                new Ex("CA Final", "Financial Reporting", "Strategic Financial Management", "Advanced Auditing", "Direct Tax", "Indirect Tax"),
                new Ex("CS", "Jurisprudence", "Company Law", "Tax Laws", "Economic & Commercial Laws"),
                new Ex("CMA", "Financial Accounting", "Cost Accounting", "Laws & Ethics", "Direct Taxation")),
            new Cat("Management",
                new Ex("CAT", "Quantitative Ability", "Verbal Ability & RC", "Data Interpretation & LR"),
                new Ex("XAT", "Quantitative Ability", "Verbal Ability", "Decision Making", "General Knowledge"),
                new Ex("MAT", "Language Comprehension", "Mathematical Skills", "Data Analysis", "Intelligence & Reasoning")),
            new Cat("Law",
                new Ex("CLAT", "English", "Current Affairs & GK", "Legal Reasoning", "Logical Reasoning", "Quantitative Techniques"),
                new Ex("AILET", "English", "General Knowledge", "Legal Aptitude", "Reasoning")),
            new Cat("Teaching & UGC",
                new Ex("CTET", "Child Development & Pedagogy", "Language I", "Language II", "Mathematics", "Environmental Studies"),
                new Ex("UGC NET", "Teaching Aptitude", "Research Aptitude", "Paper II Subject"),
                new Ex("State TET", "Child Development & Pedagogy", "Language", "Mathematics", "EVS")),
            new Cat("School (Boards)",
                new Ex("CBSE Class 12", "Physics", "Chemistry", "Mathematics", "Biology", "English",
                        "Accountancy", "Business Studies", "Economics", "Computer Science"),
                new Ex("CBSE Class 11", "Physics", "Chemistry", "Mathematics", "Biology", "English",
                        "Accountancy", "Business Studies", "Economics"),
                new Ex("CBSE Class 10", "Mathematics", "Science", "Social Science", "English", "Hindi"),
                new Ex("ICSE Class 12", "Physics", "Chemistry", "Mathematics", "Biology", "English", "Commerce"),
                new Ex("State Board Class 12", "Physics", "Chemistry", "Mathematics", "Biology", "English")),
        };

        List<ExamCategory> categories = new ArrayList<>();
        int ci = 0;
        for (Cat c : data) {
            ExamCategory category = ExamCategory.builder().name(c.name()).displayOrder(ci++).active(true).build();
            List<Exam> exams = new ArrayList<>();
            int ei = 0;
            for (Ex e : c.exams()) {
                Exam exam = Exam.builder().category(category).name(e.name()).displayOrder(ei++).active(true).build();
                List<Subject> subjects = new ArrayList<>();
                int si = 0;
                for (String s : e.subjects()) {
                    subjects.add(Subject.builder().exam(exam).name(s).displayOrder(si++).active(true).build());
                }
                exam.setSubjects(subjects);
                exams.add(exam);
            }
            category.setExams(exams);
            categories.add(category);
        }
        categoryRepository.saveAll(categories);
        log.info("Seeded {} exam categories.", categories.size());
    }
}

package com.topnotes.config;

import com.topnotes.entity.AgreementDocument;
import com.topnotes.entity.enums.AgreementType;
import com.topnotes.repository.AgreementDocumentRepository;
import com.topnotes.util.HashUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Seeds v1 of each legal agreement if no active version exists yet. Idempotent —
 * never overwrites. To revise an agreement later, add a NEW version (higher number,
 * active=true) and deactivate the old one; existing consent records stay valid
 * against the version/hash they were signed under.
 */
@Component
@Order(50)
@Slf4j
public class AgreementSeeder implements CommandLineRunner {

    private final AgreementDocumentRepository repo;

    public AgreementSeeder(AgreementDocumentRepository repo) {
        this.repo = repo;
    }

    @Override
    @Transactional
    public void run(String... args) {
        int seeded = 0;
        seeded += seed(AgreementType.SELLER_AGREEMENT, "TopNotes Seller Agreement", SELLER_AGREEMENT_V1);
        seeded += seed(AgreementType.ORIGINALITY_DECLARATION, "Notes Originality Declaration", ORIGINALITY_V1);
        if (seeded > 0) log.info("Seeded {} agreement document(s).", seeded);
    }

    private int seed(AgreementType type, String title, String body) {
        if (repo.findByTypeAndActiveTrue(type).isPresent()) return 0;
        repo.save(AgreementDocument.builder()
                .type(type)
                .version(1)
                .title(title)
                .body(body.strip())
                .contentHash(HashUtil.sha256Hex(body.strip()))
                .active(true)
                .build());
        return 1;
    }

    private static final String SELLER_AGREEMENT_V1 = """
            By becoming a seller on TopNotes you agree to the following:

            1. Ownership & originality. Every note you upload is your own original work, or work you
               hold the full legal right to sell. You will not upload notes copied from any coaching
               institute, textbook, website, another student, or any third party.

            2. No infringement. Your uploads do not infringe anyone's copyright, trademark, or other
               intellectual-property or privacy rights.

            3. Licence to TopNotes. You grant TopNotes a non-exclusive licence to host, display,
               watermark, and sell your notes to buyers on the platform, and to share previews for
               marketing the listing.

            4. Accurate information. The marksheet and details you submit for qualification are
               genuine and belong to you.

            5. Indemnity. If a third party brings a claim arising from content you uploaded, you will
               indemnify TopNotes against that claim, and TopNotes may remove the content and suspend
               your seller account.

            6. Conduct. You will not upload unlawful, plagiarised, or misleading material. Violations
               may lead to removal of notes, withholding of payouts for disputed sales, and account
               suspension.

            You confirm you have read and agree to this Seller Agreement.
            """;

    private static final String ORIGINALITY_V1 = """
            For the note you are uploading, you declare that:

            • These notes are your own original handwritten/created work.
            • They are not copied or scanned from any coaching institute, published book, website, or
              another person's material.
            • You hold the rights to sell this content on TopNotes.

            You understand that false declarations can lead to removal of the note, reversal of related
            payouts, and suspension of your seller account.
            """;
}

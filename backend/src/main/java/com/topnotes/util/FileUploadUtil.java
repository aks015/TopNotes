package com.topnotes.util;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import com.topnotes.config.CloudinaryProperties;
import com.topnotes.exception.BadRequestException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.util.List;
import java.util.Map;

@Component
@Slf4j
public class FileUploadUtil {

    private static final long MAX_PDF_SIZE_BYTES = 50 * 1024 * 1024; // 50MB (matches the upload UI + multipart limit)
    private static final long MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

    private static final long MAX_MARKSHEET_SIZE_BYTES = 10 * 1024 * 1024; // 10MB (PDF or image)

    private static final List<String> ALLOWED_PDF_TYPES   = List.of("application/pdf");
    private static final List<String> ALLOWED_IMAGE_TYPES = List.of("image/jpeg", "image/png", "image/webp");
    /** Marksheets may be a photo/scan (image) or a PDF document. */
    private static final List<String> ALLOWED_MARKSHEET_TYPES =
            List.of("image/jpeg", "image/png", "image/webp", "application/pdf");

    private static final String CLOUDINARY_NOT_CONFIGURED =
            "File storage is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, "
                    + "and CLOUDINARY_API_SECRET on the server.";

    private final Cloudinary cloudinary;
    private final CloudinaryProperties cloudinaryProperties;

    public FileUploadUtil(Cloudinary cloudinary, CloudinaryProperties cloudinaryProperties) {
        this.cloudinary = cloudinary;
        this.cloudinaryProperties = cloudinaryProperties;
    }

    /** Validates and stores a PDF to Cloudinary. Returns secure web URL. */
    public String storePdf(MultipartFile file) throws IOException {
        validateFile(file, ALLOWED_PDF_TYPES, MAX_PDF_SIZE_BYTES, "PDF");
        return uploadToCloudinary(file, "topnotes/pdfs", "raw");
    }

    /** Validates and stores a thumbnail image to Cloudinary. Returns secure web URL. */
    public String storeThumbnail(MultipartFile file) throws IOException {
        validateFile(file, ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE_BYTES, "thumbnail image");
        return uploadToCloudinary(file, "topnotes/thumbnails", "image");
    }

    /** Stores raw generated image bytes (e.g. a rendered PDF cover) to Cloudinary. */
    public String storeGeneratedThumbnail(byte[] imageBytes) throws IOException {
        ensureCloudinaryConfigured();
        Map params = ObjectUtils.asMap("folder", "topnotes/thumbnails", "resource_type", "image");
        try {
            Map result = cloudinary.uploader().upload(imageBytes, params);
            return (String) result.get("secure_url");
        } catch (RuntimeException e) {
            throw new BadRequestException("Failed to upload generated cover: " + e.getMessage());
        }
    }

    /** Validates and stores a marksheet (image OR PDF) to Cloudinary. */
    public String storeMarksheet(MultipartFile file) throws IOException {
        validateFile(file, ALLOWED_MARKSHEET_TYPES, MAX_MARKSHEET_SIZE_BYTES, "marksheet (image or PDF)");
        // "auto" lets Cloudinary handle both images and PDFs from one endpoint.
        return uploadToCloudinary(file, "topnotes/marksheets", "auto");
    }

    /** Validates and stores a profile image to Cloudinary. */
    public String storeProfileImage(MultipartFile file) throws IOException {
        validateFile(file, ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE_BYTES, "profile image");
        return uploadToCloudinary(file, "topnotes/profiles", "image");
    }

    /** Reads raw file bytes for secure rendering. */
    public byte[] readFileBytes(String urlOrPath) throws IOException {
        if (urlOrPath == null || urlOrPath.isBlank()) {
            throw new BadRequestException("Invalid file URL or path");
        }
        if (urlOrPath.startsWith("http://") || urlOrPath.startsWith("https://")) {
            try (InputStream in = new URL(urlOrPath).openStream()) {
                return in.readAllBytes();
            }
        }
        throw new BadRequestException("File path must be a valid Cloudinary URL: " + urlOrPath);
    }

    public void deleteFile(String relativeUrl) {
        log.debug("Cloudinary automated asset lifecycle managed online for: {}", relativeUrl);
    }

    private void ensureCloudinaryConfigured() {
        if (!cloudinaryProperties.isConfigured()) {
            log.error("Cloudinary credentials are missing from the server environment");
            throw new BadRequestException(CLOUDINARY_NOT_CONFIGURED);
        }
    }

    private String uploadToCloudinary(MultipartFile file, String folder, String resourceType) throws IOException {
        ensureCloudinaryConfigured();

        Map params = ObjectUtils.asMap(
                "folder", folder,
                "resource_type", resourceType
        );

        try {
            Map uploadResult = cloudinary.uploader().upload(file.getBytes(), params);
            String secureUrl = (String) uploadResult.get("secure_url");
            log.info("Successfully pushed asset to Cloudinary. Remote URL -> {}", secureUrl);
            return secureUrl;
        } catch (RuntimeException e) {
            log.error("Cloudinary upload failed: {}", e.getMessage());
            throw new BadRequestException("Failed to upload file to storage: " + e.getMessage());
        }
    }

    private void validateFile(MultipartFile file, List<String> allowedTypes, long maxSize, String typeName) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException(typeName + " file is empty or missing");
        }
        if (!allowedTypes.contains(file.getContentType())) {
            throw new BadRequestException("Invalid " + typeName + " format. Allowed: " + allowedTypes);
        }
        if (file.getSize() > maxSize) {
            throw new BadRequestException(typeName + " exceeds maximum allowed size.");
        }
    }
}

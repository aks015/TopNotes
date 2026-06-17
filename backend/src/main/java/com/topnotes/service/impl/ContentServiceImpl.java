package com.topnotes.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.topnotes.entity.SiteContent;
import com.topnotes.exception.BadRequestException;
import com.topnotes.repository.SiteContentRepository;
import com.topnotes.service.ContentService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;

@Service
@Slf4j
public class ContentServiceImpl implements ContentService {

    private static final String LANDING = "landing";

    private final SiteContentRepository repository;
    private final ObjectMapper objectMapper;

    public ContentServiceImpl(SiteContentRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    @Override
    public JsonNode getLanding() {
        SiteContent sc = repository.findById(LANDING).orElseGet(this::seedDefault);
        try {
            return objectMapper.readTree(sc.getContent());
        } catch (Exception e) {
            throw new BadRequestException("Stored site content is not valid JSON");
        }
    }

    @Override
    @Transactional
    public JsonNode updateLanding(JsonNode content) {
        if (content == null || content.isNull() || !content.isObject()) {
            throw new BadRequestException("Landing content must be a JSON object");
        }
        SiteContent sc = repository.findById(LANDING)
                .orElseGet(() -> new SiteContent(LANDING, null, null));
        try {
            sc.setContent(objectMapper.writeValueAsString(content));
        } catch (Exception e) {
            throw new BadRequestException("Could not serialise content");
        }
        repository.save(sc);
        return content;
    }

    /** First request seeds the DB from the bundled default-landing.json. */
    private SiteContent seedDefault() {
        try {
            String json = new String(
                    new ClassPathResource("default-landing.json").getInputStream().readAllBytes(),
                    StandardCharsets.UTF_8);
            log.info("Seeding default landing content");
            return repository.save(new SiteContent(LANDING, json, null));
        } catch (Exception e) {
            throw new BadRequestException("Could not load default landing content");
        }
    }
}

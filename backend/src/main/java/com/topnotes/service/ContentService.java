package com.topnotes.service;

import com.fasterxml.jackson.databind.JsonNode;

/** Admin-editable site content (landing page CMS). */
public interface ContentService {
    JsonNode getLanding();
    JsonNode updateLanding(JsonNode content);
}

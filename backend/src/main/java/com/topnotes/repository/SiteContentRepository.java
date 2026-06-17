package com.topnotes.repository;

import com.topnotes.entity.SiteContent;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SiteContentRepository extends JpaRepository<SiteContent, String> {
}

package com.leafrpa.service.market;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MarketAppCommentRepository extends JpaRepository<MarketAppComment, Long> {

    Page<MarketAppComment> findByAppIdOrderByCreatedAtDesc(Long appId, Pageable pageable);

    MarketAppComment findByIdAndAppId(Long id, Long appId);
}

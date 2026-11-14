package com.leafrpa.service.market;

import org.springframework.data.jpa.repository.JpaRepository;

public interface MarketInstallRepository extends JpaRepository<MarketInstall, Long> {

    boolean existsByUserIdAndAppId(Long userId, Long appId);

    MarketInstall findByUserIdAndAppId(Long userId, Long appId);
}

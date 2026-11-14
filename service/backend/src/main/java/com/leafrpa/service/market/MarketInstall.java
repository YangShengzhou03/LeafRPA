package com.leafrpa.service.market;

import jakarta.persistence.*;
import java.time.Instant;

/** 市场应用安装记录：同一用户对同一应用仅允许一条，保证安装计数去重。 */
@Entity
@Table(name = "market_installs")
public class MarketInstall {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false)
    private Long appId;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public Long getAppId() { return appId; }
    public void setAppId(Long appId) { this.appId = appId; }
    public Instant getCreatedAt() { return createdAt; }
}

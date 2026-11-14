package com.leafrpa.service.market;

import jakarta.persistence.*;
import java.time.Instant;

/** 市场应用评分：同一用户对同一应用仅一条（唯一键去重），重复打分即更新该行。 */
@Entity
@Table(name = "market_app_ratings")
public class MarketAppRating {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false)
    private Long appId;

    /** 星级 1-5（表列 TINYINT，非 TINYINT(1)，避免驱动按布尔解析） */
    @Column(nullable = false)
    private int stars;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(nullable = false)
    private Instant updatedAt = Instant.now();

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public Long getAppId() { return appId; }
    public void setAppId(Long appId) { this.appId = appId; }
    public int getStars() { return stars; }
    public void setStars(int stars) { this.stars = stars; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}

package com.leafrpa.service.market;

import jakarta.persistence.*;
import java.time.Instant;

/** 市场应用评论：作者以 user_id 记账（展示名由服务端解析为用户名），仅本人可删。 */
@Entity
@Table(name = "market_app_comments")
public class MarketAppComment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long appId;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false, length = 500)
    private String content;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public Long getId() { return id; }
    public Long getAppId() { return appId; }
    public void setAppId(Long appId) { this.appId = appId; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public Instant getCreatedAt() { return createdAt; }
}

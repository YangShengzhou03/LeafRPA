package com.leafrpa.service.market;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "market_apps")
public class MarketApp {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 64)
    private String name;

    @Column(nullable = false, length = 255)
    private String description;

    @Column(nullable = false, length = 32)
    private String category;

    /** 安装量（真实计数） */
    @Column(nullable = false)
    private long installs = 0;

    /** 市场卡片主色，如 #3b6fe0 */
    @Column(nullable = false, length = 9)
    private String color;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public Long getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public long getInstalls() { return installs; }
    public void setInstalls(long installs) { this.installs = installs; }
    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }
    public Instant getCreatedAt() { return createdAt; }
}

package com.leafrpa.service.flow;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "shared_flows")
public class SharedFlow {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 32)
    private String author;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(length = 255)
    private String description;

    /** 节点数，导出时由前端统计后上报 */
    @Column(nullable = false)
    private int nodeCount = 0;

    /** 服务端存储的文件名（UUID.leafrpa），原名不入盘 */
    @Column(nullable = false, length = 64)
    private String fileName;

    @Column(nullable = false)
    private long downloads = 0;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public Long getId() { return id; }
    public String getAuthor() { return author; }
    public void setAuthor(String author) { this.author = author; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public int getNodeCount() { return nodeCount; }
    public void setNodeCount(int nodeCount) { this.nodeCount = nodeCount; }
    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }
    public long getDownloads() { return downloads; }
    public void setDownloads(long downloads) { this.downloads = downloads; }
    public Instant getCreatedAt() { return createdAt; }
}

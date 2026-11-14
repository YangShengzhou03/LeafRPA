package com.leafrpa.service.community;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "posts")
public class Post {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 32)
    private String author;

    @Column(nullable = false, length = 120)
    private String title;

    /** 帖子分类，如 经验分享 / 问题求助 / 版本更新 */
    @Column(nullable = false, length = 32)
    private String category = "经验分享";

    /** utf8mb4 下 varchar 上限 16383，长内容使用 TEXT */
    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(nullable = false)
    private long likes = 0;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @OneToMany(mappedBy = "post", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("createdAt asc")
    private List<Reply> replies = new ArrayList<>();

    public Long getId() { return id; }
    public String getAuthor() { return author; }
    public void setAuthor(String author) { this.author = author; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public long getLikes() { return likes; }
    public void setLikes(long likes) { this.likes = likes; }
    public Instant getCreatedAt() { return createdAt; }
    public List<Reply> getReplies() { return replies; }
}

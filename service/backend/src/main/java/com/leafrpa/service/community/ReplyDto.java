package com.leafrpa.service.community;

import java.time.Instant;

public record ReplyDto(Long id, String author, String content, Instant createdAt) {

    public static ReplyDto from(Reply r) {
        return new ReplyDto(r.getId(), r.getAuthor(), r.getContent(), r.getCreatedAt());
    }
}

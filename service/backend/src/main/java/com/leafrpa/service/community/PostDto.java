package com.leafrpa.service.community;

import java.time.Instant;
import java.util.List;

/** 帖子响应 DTO：liked 为当前登录用户是否已点赞（未登录恒为 false）。 */
public record PostDto(Long id, String author, String title, String content, String category,
                      long likes, boolean liked, Instant createdAt, List<ReplyDto> replies) {

    public static PostDto from(Post p, boolean liked) {
        return new PostDto(p.getId(), p.getAuthor(), p.getTitle(), p.getContent(), p.getCategory(),
                p.getLikes(), liked, p.getCreatedAt(),
                p.getReplies().stream().map(ReplyDto::from).toList());
    }
}

package com.leafrpa.service.community;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface PostLikeRepository extends JpaRepository<PostLike, Long> {

    boolean existsByUserIdAndPostId(Long userId, Long postId);

    PostLike findByUserIdAndPostId(Long userId, Long postId);

    /** 批量查询某用户在给定帖子集合中的点赞记录（列表页一次查全） */
    List<PostLike> findByUserIdAndPostIdIn(Long userId, Collection<Long> postIds);
}

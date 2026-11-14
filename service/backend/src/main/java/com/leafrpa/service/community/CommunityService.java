package com.leafrpa.service.community;

import com.leafrpa.service.common.ApiException;
import com.leafrpa.service.common.PageResult;
import com.leafrpa.service.user.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class CommunityService {

    /** 列表接口单页大小上限，防止恶意拉全量 */
    private static final int MAX_PAGE_SIZE = 50;

    private final PostRepository postRepository;
    private final ReplyRepository replyRepository;
    private final PostLikeRepository likeRepository;

    public CommunityService(PostRepository postRepository,
                            ReplyRepository replyRepository,
                            PostLikeRepository likeRepository) {
        this.postRepository = postRepository;
        this.replyRepository = replyRepository;
        this.likeRepository = likeRepository;
    }

    /** 帖子分页列表：sort=latest / hot；viewer 非空时回显每篇帖子的点赞状态。 */
    @Transactional(readOnly = true)
    public PageResult<PostDto> list(boolean hot, String category, String keyword, int page, int size, User viewer) {
        String cat = category == null || "全部".equals(category.trim()) ? "" : category.trim();
        String kw = keyword == null ? "" : keyword.trim();
        int p = Math.max(0, page);
        int s = Math.min(MAX_PAGE_SIZE, Math.max(1, size));
        Page<Post> result = (hot
                ? postRepository.findHot(cat, kw, PageRequest.of(p, s))
                : postRepository.findLatest(cat, kw, PageRequest.of(p, s)));
        Set<Long> likedIds = likedPostIds(viewer, result.getContent());
        List<PostDto> items = result.getContent().stream()
                .map(post -> PostDto.from(post, likedIds.contains(post.getId())))
                .toList();
        return PageResult.of(items, result.getTotalElements(), p, s);
    }

    @Transactional(readOnly = true)
    public PostDto detailDto(long id, User viewer) {
        Post post = detail(id);
        boolean liked = viewer != null && likeRepository.existsByUserIdAndPostId(viewer.getId(), post.getId());
        return PostDto.from(post, liked);
    }

    @Transactional
    public PostDto create(User author, String title, String content, String category) {
        String t = title == null ? "" : title.trim();
        if (t.isEmpty()) {
            throw ApiException.badRequest("请填写帖子标题");
        }
        if (t.length() > 64) {
            throw ApiException.badRequest("标题不能超过 64 字");
        }
        String body = content == null ? "" : content.trim();
        if (body.isEmpty()) {
            throw ApiException.badRequest("请填写帖子内容");
        }
        if (body.length() > 10000) {
            throw ApiException.badRequest("内容不能超过 10000 字");
        }
        Post post = new Post();
        post.setAuthor(author.getUsername());
        post.setTitle(t);
        post.setContent(body);
        String cat = category == null ? "" : category.trim();
        post.setCategory(cat.isEmpty() ? "经验分享" : cat);
        return PostDto.from(postRepository.save(post), false);
    }

    @Transactional
    public ReplyDto reply(User author, long postId, String content) {
        String text = content == null ? "" : content.trim();
        if (text.isEmpty()) {
            throw ApiException.badRequest("请填写回复内容");
        }
        if (text.length() > 2000) {
            throw ApiException.badRequest("回复不能超过 2000 字");
        }
        Post post = detail(postId);
        Reply reply = new Reply();
        reply.setPost(post);
        reply.setAuthor(author.getUsername());
        reply.setContent(text);
        post.getReplies().add(reply);
        return ReplyDto.from(reply);
    }

    /** 删除帖子：仅作者本人可删，回复随帖子级联删除。 */
    @Transactional
    public void delete(User user, long id) {
        Post post = detail(id);
        if (!post.getAuthor().equals(user.getUsername())) {
            throw ApiException.unauthorized("只有作者本人可以删除该帖子");
        }
        postRepository.delete(post);
    }

    /** 删除回复：仅回复作者本人可删；从帖子集合移除，由 orphanRemoval 同步删除记录。 */
    @Transactional
    public void deleteReply(User user, long postId, long replyId) {
        Post post = detail(postId);
        Reply reply = replyRepository.findById(replyId)
                .orElseThrow(() -> ApiException.notFound("回复不存在"));
        if (reply.getPost() == null || !post.getId().equals(reply.getPost().getId())) {
            throw ApiException.notFound("回复不存在");
        }
        if (!reply.getAuthor().equals(user.getUsername())) {
            throw ApiException.unauthorized("只有回复作者本人可以删除该回复");
        }
        post.getReplies().remove(reply);
    }

    public Post detail(long id) {
        return postRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("帖子不存在"));
    }

    /** 点赞切换：已点赞则取消，未点赞则 +1；同一用户重复点赞不会重复计数。 */
    @Transactional
    public LikeResult like(User user, long id) {
        Post post = detail(id);
        PostLike existing = likeRepository.findByUserIdAndPostId(user.getId(), post.getId());
        boolean liked;
        if (existing != null) {
            likeRepository.delete(existing);
            postRepository.decrementLikes(post.getId());
            liked = false;
        } else {
            PostLike like = new PostLike();
            like.setUserId(user.getId());
            like.setPostId(post.getId());
            likeRepository.save(like);
            postRepository.incrementLikes(post.getId());
            liked = true;
        }
        return new LikeResult(postRepository.likesOf(post.getId()), liked);
    }

    /** 批量取某用户在一批帖子中的点赞帖子 id 集合；未登录返回空集。 */
    private Set<Long> likedPostIds(User viewer, List<Post> posts) {
        if (viewer == null || posts.isEmpty()) {
            return Set.of();
        }
        List<Long> ids = posts.stream().map(Post::getId).toList();
        return likeRepository.findByUserIdAndPostIdIn(viewer.getId(), ids).stream()
                .map(PostLike::getPostId)
                .collect(Collectors.toSet());
    }

    public record LikeResult(long likes, boolean liked) {
    }
}

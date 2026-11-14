package com.leafrpa.service.market;

import com.leafrpa.service.common.ApiException;
import com.leafrpa.service.user.User;
import com.leafrpa.service.user.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 市场应用「打分 + 评论」业务：
 * 评分按（用户, 应用）唯一去重，重复打分即更新；
 * 评论仅作者本人可删；未登录也可查看评分与评论（myRating 恒为 null）。
 */
@Service
public class MarketFeedbackService {

    /** 评论分页单页大小上限，防止恶意拉全量 */
    private static final int MAX_PAGE_SIZE = 50;

    private final MarketService marketService;
    private final MarketAppRatingRepository ratingRepository;
    private final MarketAppCommentRepository commentRepository;
    private final UserRepository userRepository;

    public MarketFeedbackService(MarketService marketService,
                                 MarketAppRatingRepository ratingRepository,
                                 MarketAppCommentRepository commentRepository,
                                 UserRepository userRepository) {
        this.marketService = marketService;
        this.ratingRepository = ratingRepository;
        this.commentRepository = commentRepository;
        this.userRepository = userRepository;
    }

    /** 评分 + 评论聚合视图；viewer 为空（未登录）时 myRating 恒为 null；评论按时间倒序分页。 */
    @Transactional(readOnly = true)
    public FeedbackDto feedback(long appId, User viewer, int page, int size) {
        marketService.detail(appId);
        int p = Math.max(0, page);
        int s = Math.min(MAX_PAGE_SIZE, Math.max(1, size));
        Page<MarketAppComment> comments = commentRepository.findByAppIdOrderByCreatedAtDesc(appId, PageRequest.of(p, s));
        Summary summary = summaryOf(appId);
        Integer myRating = viewer == null ? null
                : optionalStars(ratingRepository.findByUserIdAndAppId(viewer.getId(), appId));
        Map<Long, User> authors = userRepository.findAllById(
                        comments.getContent().stream().map(MarketAppComment::getUserId).toList()).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));
        List<CommentDto> items = comments.getContent().stream()
                .map(c -> CommentDto.of(c, authorName(authors, c.getUserId())))
                .toList();
        return new FeedbackDto(comments.getTotalElements(), summary.averageRating(), summary.ratingCount(), myRating, items);
    }

    /** 打分（需登录）：1-5 星整数；同一用户重复打分即更新。 */
    @Transactional
    public RatingResult rate(User user, long appId, int stars) {
        if (stars < 1 || stars > 5) {
            throw ApiException.badRequest("评分需为 1-5 星整数");
        }
        marketService.detail(appId);
        MarketAppRating rating = ratingRepository.findByUserIdAndAppId(user.getId(), appId);
        if (rating == null) {
            rating = new MarketAppRating();
            rating.setUserId(user.getId());
            rating.setAppId(appId);
            rating.setStars(stars);
            ratingRepository.save(rating);
        } else {
            rating.setStars(stars);
            rating.setUpdatedAt(Instant.now());
        }
        return summaryResult(appId, stars);
    }

    /** 撤销评分（需登录）：未评过时幂等返回当前汇总。 */
    @Transactional
    public RatingResult removeRating(User user, long appId) {
        marketService.detail(appId);
        MarketAppRating rating = ratingRepository.findByUserIdAndAppId(user.getId(), appId);
        if (rating != null) {
            ratingRepository.delete(rating);
        }
        return summaryResult(appId, null);
    }

    /** 发表评论（需登录）：内容 1-500 字。 */
    @Transactional
    public CommentDto comment(User user, long appId, String content) {
        String text = content == null ? "" : content.trim();
        if (text.isEmpty()) {
            throw ApiException.badRequest("请填写评论内容");
        }
        if (text.length() > 500) {
            throw ApiException.badRequest("评论不能超过 500 字");
        }
        marketService.detail(appId);
        MarketAppComment comment = new MarketAppComment();
        comment.setAppId(appId);
        comment.setUserId(user.getId());
        comment.setContent(text);
        return CommentDto.of(commentRepository.save(comment), user.getUsername());
    }

    /** 删除评论：仅评论作者本人可删。 */
    @Transactional
    public void deleteComment(User user, long appId, long commentId) {
        marketService.detail(appId);
        MarketAppComment comment = commentRepository.findByIdAndAppId(commentId, appId);
        if (comment == null) {
            throw ApiException.notFound("评论不存在");
        }
        if (!comment.getUserId().equals(user.getId())) {
            throw ApiException.unauthorized("只有评论作者本人可以删除该评论");
        }
        commentRepository.delete(comment);
    }

    /* ---- 汇总 ---- */

    private Summary summaryOf(long appId) {
        Object[] row = ratingRepository.summarizeByAppId(appId).get(0);
        double avg = row[0] == null ? 0d : ((Number) row[0]).doubleValue();
        long count = ((Number) row[1]).longValue();
        return new Summary(round1(avg), count);
    }

    private RatingResult summaryResult(long appId, Integer myRating) {
        Summary summary = summaryOf(appId);
        return new RatingResult(summary.averageRating(), summary.ratingCount(), myRating);
    }

    private static Integer optionalStars(MarketAppRating rating) {
        return rating == null ? null : rating.getStars();
    }

    private static String authorName(Map<Long, User> authors, Long userId) {
        User user = authors.get(userId);
        return user == null ? "unknown" : user.getUsername();
    }

    /** 平均分保留 1 位小数（四舍五入） */
    private static double round1(double value) {
        return Math.round(value * 10) / 10.0;
    }

    private record Summary(double averageRating, long ratingCount) {
    }

    /** 评分 + 评论聚合视图（commentTotal 为评论总数，供前端「查看更多」判断） */
    public record FeedbackDto(long commentTotal, double averageRating, long ratingCount, Integer myRating,
                              List<CommentDto> comments) {
    }

    public record CommentDto(long id, String author, String content, Instant createdAt) {

        static CommentDto of(MarketAppComment comment, String author) {
            return new CommentDto(comment.getId(), author, comment.getContent(), comment.getCreatedAt());
        }
    }

    public record RatingResult(double averageRating, long ratingCount, Integer myRating) {
    }
}

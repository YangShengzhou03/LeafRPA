package com.leafrpa.service.market;

import com.leafrpa.service.common.ApiResponse;
import com.leafrpa.service.common.CurrentUser;
import com.leafrpa.service.user.User;
import org.springframework.web.bind.annotation.*;

/** 市场应用「打分 + 评论」接口：查看无需登录，打分/评论/删除需登录。 */
@RestController
@RequestMapping("/api/market")
public class MarketFeedbackController {

    private final MarketFeedbackService feedbackService;

    public MarketFeedbackController(MarketFeedbackService feedbackService) {
        this.feedbackService = feedbackService;
    }

    /** 评分与评论聚合视图：未登录可看（myRating 恒为 null）；comments 按时间倒序，page 从 0 开始，size 默认 20。 */
    @GetMapping("/apps/{appId}/feedback")
    public ApiResponse<MarketFeedbackService.FeedbackDto> feedback(@CurrentUser(required = false) User viewer,
                                                                   @PathVariable long appId,
                                                                   @RequestParam(defaultValue = "0") int page,
                                                                   @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.ok(feedbackService.feedback(appId, viewer, page, size));
    }

    /** 打分（需登录）：body {stars 1-5}；同一用户重复打分即更新，返回最新汇总。 */
    @PostMapping("/apps/{appId}/rating")
    public ApiResponse<MarketFeedbackService.RatingResult> rate(@CurrentUser User user,
                                                                @PathVariable long appId,
                                                                @RequestBody RateRequest body) {
        return ApiResponse.ok(feedbackService.rate(user, appId, body.stars()));
    }

    /** 撤销自己的评分（需登录），返回最新汇总。 */
    @DeleteMapping("/apps/{appId}/rating")
    public ApiResponse<MarketFeedbackService.RatingResult> removeRating(@CurrentUser User user, @PathVariable long appId) {
        return ApiResponse.ok(feedbackService.removeRating(user, appId));
    }

    /** 发表评论（需登录）：body {content 1-500}。 */
    @PostMapping("/apps/{appId}/comments")
    public ApiResponse<MarketFeedbackService.CommentDto> comment(@CurrentUser User user,
                                                                 @PathVariable long appId,
                                                                 @RequestBody CommentRequest body) {
        return ApiResponse.ok(feedbackService.comment(user, appId, body.content()));
    }

    /** 删除评论：仅评论作者本人可删。 */
    @DeleteMapping("/apps/{appId}/comments/{commentId}")
    public ApiResponse<Void> deleteComment(@CurrentUser User user, @PathVariable long appId, @PathVariable long commentId) {
        feedbackService.deleteComment(user, appId, commentId);
        return ApiResponse.ok(null);
    }

    public record RateRequest(int stars) {
    }

    public record CommentRequest(String content) {
    }
}

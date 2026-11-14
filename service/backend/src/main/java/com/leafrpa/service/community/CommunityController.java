package com.leafrpa.service.community;

import com.leafrpa.service.common.ApiResponse;
import com.leafrpa.service.common.CurrentUser;
import com.leafrpa.service.common.PageResult;
import com.leafrpa.service.user.User;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/community")
public class CommunityController {

    private final CommunityService communityService;

    public CommunityController(CommunityService communityService) {
        this.communityService = communityService;
    }

    public record CreatePostRequest(
            @NotBlank @Size(max = 120) String title,
            @NotBlank @Size(max = 20000) String content,
            @Size(max = 32) String category) {
    }

    public record ReplyRequest(@NotBlank @Size(max = 5000) String content) {
    }

    /**
     * 帖子分页流：sort=latest / hot，category 分类过滤（全部/空为不过滤），keyword 模糊匹配标题与内容；
     * page 从 0 开始，size 默认 20（上限 50）；登录时回显 liked 点赞状态。
     */
    @GetMapping("/posts")
    public ApiResponse<PageResult<PostDto>> list(@CurrentUser(required = false) User viewer,
                                                 @RequestParam(defaultValue = "latest") String sort,
                                                 @RequestParam(defaultValue = "全部") String category,
                                                 @RequestParam(defaultValue = "") String keyword,
                                                 @RequestParam(defaultValue = "0") int page,
                                                 @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.ok(communityService.list("hot".equals(sort), category, keyword, page, size, viewer));
    }

    /** 帖子详情：登录时回显 liked 点赞状态。 */
    @GetMapping("/posts/{id}")
    public ApiResponse<PostDto> detail(@CurrentUser(required = false) User viewer, @PathVariable long id) {
        return ApiResponse.ok(communityService.detailDto(id, viewer));
    }

    @PostMapping("/posts")
    public ApiResponse<PostDto> create(@CurrentUser User user, @Valid @RequestBody CreatePostRequest req) {
        return ApiResponse.ok(communityService.create(user, req.title(), req.content(), req.category()));
    }

    @DeleteMapping("/posts/{id}")
    public ApiResponse<Void> delete(@CurrentUser User user, @PathVariable long id) {
        communityService.delete(user, id);
        return ApiResponse.ok(null);
    }

    @PostMapping("/posts/{id}/replies")
    public ApiResponse<ReplyDto> reply(@CurrentUser User user, @PathVariable long id,
                                       @Valid @RequestBody ReplyRequest req) {
        return ApiResponse.ok(communityService.reply(user, id, req.content()));
    }

    /** 删除回复：仅回复作者本人可删。 */
    @DeleteMapping("/posts/{id}/replies/{replyId}")
    public ApiResponse<Void> deleteReply(@CurrentUser User user, @PathVariable long id,
                                         @PathVariable long replyId) {
        communityService.deleteReply(user, id, replyId);
        return ApiResponse.ok(null);
    }

    /** 点赞切换：返回最新点赞数与当前用户点赞状态。 */
    @PostMapping("/posts/{id}/like")
    public ApiResponse<CommunityService.LikeResult> like(@CurrentUser User user, @PathVariable long id) {
        return ApiResponse.ok(communityService.like(user, id));
    }
}

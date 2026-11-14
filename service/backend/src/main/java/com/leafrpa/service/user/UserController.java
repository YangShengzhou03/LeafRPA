package com.leafrpa.service.user;

import com.leafrpa.service.common.ApiException;
import com.leafrpa.service.common.ApiResponse;
import com.leafrpa.service.common.CurrentUser;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/** 用户资料：/me 为当前登录用户读写；/{username} 为公开资料，任何人可查（含未登录）。 */
@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserRepository userRepository;
    private final UserProfileService userProfileService;

    public UserController(UserRepository userRepository, UserProfileService userProfileService) {
        this.userRepository = userRepository;
        this.userProfileService = userProfileService;
    }

    /** 当前登录用户完整资料（含打码手机号与社区统计）。 */
    @GetMapping("/me")
    public ApiResponse<UserDtos.ProfileResponse> me(@CurrentUser User user) {
        return ApiResponse.ok(userProfileService.profileOf(user));
    }

    /** 更新当前登录用户资料，返回更新后的完整资料。 */
    @PutMapping("/me")
    public ApiResponse<UserDtos.ProfileResponse> updateMe(@CurrentUser User user,
                                                          @RequestBody UserDtos.UpdateProfileRequest req) {
        return ApiResponse.ok(userProfileService.updateProfile(user, req));
    }

    /** 用户资料页：注册时间 + 帖子 / 回复 / 分享流程数量统计。 */
    @GetMapping("/{username}")
    public ApiResponse<Map<String, Object>> profile(@PathVariable String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> ApiException.notFound("用户不存在"));
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("username", user.getUsername());
        data.put("createdAt", user.getCreatedAt().toEpochMilli());
        data.putAll(userProfileService.counts(username));
        return ApiResponse.ok(data);
    }
}

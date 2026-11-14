package com.leafrpa.service.user;

import com.leafrpa.service.common.ApiException;
import com.leafrpa.service.community.PostRepository;
import com.leafrpa.service.community.ReplyRepository;
import com.leafrpa.service.flow.SharedFlowRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

/**
 * 用户资料读写：资料校验、更新与完整资料组装。
 * /api/users/me 与公开资料页 /api/users/{username} 共用同一套统计逻辑。
 */
@Service
public class UserProfileService {

    /** 邮箱简单格式校验：非空白本地部分 @ 域名 */
    private static final String EMAIL_REGEX = "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$";
    /** 头像图片 URL：仅允许 http/https 链接 */
    private static final String AVATAR_URL_REGEX = "^https?://\\S+$";

    private final UserRepository userRepository;
    private final PostRepository postRepository;
    private final ReplyRepository replyRepository;
    private final SharedFlowRepository sharedFlowRepository;

    public UserProfileService(UserRepository userRepository,
                              PostRepository postRepository,
                              ReplyRepository replyRepository,
                              SharedFlowRepository sharedFlowRepository) {
        this.userRepository = userRepository;
        this.postRepository = postRepository;
        this.replyRepository = replyRepository;
        this.sharedFlowRepository = sharedFlowRepository;
    }

    /** 帖子 / 回复 / 分享流程计数统计。 */
    public Map<String, Object> counts(String username) {
        return Map.of(
                "posts", postRepository.countByAuthor(username),
                "replies", replyRepository.countByAuthor(username),
                "flows", sharedFlowRepository.countByAuthor(username));
    }

    /** 完整资料：基本信息 + 打码手机号 + 社区统计。 */
    public UserDtos.ProfileResponse profileOf(User user) {
        Map<String, Object> counts = counts(user.getUsername());
        return new UserDtos.ProfileResponse(
                user.getUsername(),
                maskPhone(user.getPhone()),
                user.getNickname(),
                user.getEmail(),
                user.getGender(),
                user.getSignature(),
                user.getAvatarUrl(),
                user.getCreatedAt().toEpochMilli(),
                (Long) counts.get("posts"),
                (Long) counts.get("replies"),
                (Long) counts.get("flows"));
    }

    /** 更新资料：null 字段保持不变；更新后返回完整资料。 */
    @Transactional
    public UserDtos.ProfileResponse updateProfile(User user, UserDtos.UpdateProfileRequest req) {
        if (req.nickname() != null) {
            String value = req.nickname().trim();
            if (value.length() > 32) {
                throw ApiException.badRequest("昵称长度不能超过 32 个字符");
            }
            user.setNickname(value.isEmpty() ? null : value);
        }
        if (req.email() != null) {
            String value = req.email().trim();
            if (value.isEmpty()) {
                user.setEmail(null);
            } else {
                if (value.length() > 64) {
                    throw ApiException.badRequest("邮箱长度不能超过 64 个字符");
                }
                if (!value.matches(EMAIL_REGEX)) {
                    throw ApiException.badRequest("邮箱格式不正确");
                }
                boolean ownEmail = value.equals(user.getEmail());
                if (!ownEmail && userRepository.existsByEmail(value)) {
                    throw ApiException.conflict("该邮箱已被其他账号绑定");
                }
                user.setEmail(value);
            }
        }
        if (req.gender() != null) {
            if (!"unknown".equals(req.gender()) && !"male".equals(req.gender()) && !"female".equals(req.gender())) {
                throw ApiException.badRequest("性别取值不合法");
            }
            user.setGender(req.gender());
        }
        if (req.signature() != null) {
            String value = req.signature().trim();
            if (value.length() > 128) {
                throw ApiException.badRequest("个性签名长度不能超过 128 个字符");
            }
            user.setSignature(value.isEmpty() ? null : value);
        }
        if (req.avatarUrl() != null) {
            String value = req.avatarUrl().trim();
            if (value.isEmpty()) {
                user.setAvatarUrl(null);
            } else {
                if (value.length() > 255) {
                    throw ApiException.badRequest("头像地址长度不能超过 255 个字符");
                }
                if (!value.matches(AVATAR_URL_REGEX)) {
                    throw ApiException.badRequest("头像地址需为 http/https 链接");
                }
                user.setAvatarUrl(value);
            }
        }
        userRepository.save(user);
        return profileOf(user);
    }

    /** 手机号打码：138****1234 */
    private static String maskPhone(String phone) {
        return phone.length() >= 7
                ? phone.substring(0, 3) + "****" + phone.substring(phone.length() - 4)
                : phone;
    }
}

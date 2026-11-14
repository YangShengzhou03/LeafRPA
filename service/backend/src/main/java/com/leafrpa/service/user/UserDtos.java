package com.leafrpa.service.user;

/** 用户资料 DTO：/api/users/me 接口的请求与响应契约。 */
public class UserDtos {

    /**
     * 更新资料请求：字段全部可选，null 表示保持不变；
     * nickname / email / signature / avatarUrl 传空串表示清空（存 null）。
     */
    public record UpdateProfileRequest(
            String nickname,
            String email,
            String gender,
            String signature,
            String avatarUrl) {
    }

    /** 完整资料响应：phoneMasked 为打码手机号；posts / replies / flows 为服务端统计。 */
    public record ProfileResponse(
            String username,
            String phoneMasked,
            String nickname,
            String email,
            String gender,
            String signature,
            String avatarUrl,
            long createdAt,
            long posts,
            long replies,
            long flows) {
    }
}

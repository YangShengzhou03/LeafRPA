package com.leafrpa.service.user;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public class AuthDtos {

    public record RegisterRequest(
            @NotBlank @Size(min = 2, max = 32) String username,
            @NotBlank @Pattern(regexp = "^1\\d{10}$", message = "手机号格式不正确") String phone,
            @NotBlank @Size(min = 6, max = 64) String password,
            @NotBlank String code) {
    }

    public record LoginRequest(
            @NotBlank String username,
            @NotBlank String password) {
    }

    public record ResetRequest(
            @NotBlank String username,
            @NotBlank @Pattern(regexp = "^1\\d{10}$", message = "手机号格式不正确") String phone,
            @NotBlank @Size(min = 6, max = 64) String password) {
    }

    /** 会话信息：与前端 AuthSession 对齐，token 用于后续请求鉴权。 */
    public record SessionResponse(String username, String phone, long loginAt, String token) {
    }
}

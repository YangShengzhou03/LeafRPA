package com.leafrpa.service.user;

import com.leafrpa.service.common.ApiResponse;
import com.leafrpa.service.common.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public ApiResponse<AuthDtos.SessionResponse> register(@Valid @RequestBody AuthDtos.RegisterRequest req) {
        return ApiResponse.ok(authService.register(req));
    }

    @PostMapping("/login")
    public ApiResponse<AuthDtos.SessionResponse> login(@Valid @RequestBody AuthDtos.LoginRequest req) {
        return ApiResponse.ok(authService.login(req));
    }

    @PostMapping("/reset-password")
    public ApiResponse<AuthDtos.SessionResponse> resetPassword(@Valid @RequestBody AuthDtos.ResetRequest req) {
        return ApiResponse.ok(authService.resetPassword(req));
    }

    /** 获取当前登录用户信息，用于校验 token 有效性。 */
    @GetMapping("/me")
    public ApiResponse<Map<String, Object>> me(@CurrentUser User user) {
        return ApiResponse.ok(Map.of(
                "username", user.getUsername(),
                "phone", user.getPhone(),
                "createdAt", user.getCreatedAt().toEpochMilli()));
    }
}

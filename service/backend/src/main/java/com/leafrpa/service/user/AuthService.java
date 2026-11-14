package com.leafrpa.service.user;

import com.leafrpa.service.common.ApiException;
import com.leafrpa.service.common.JwtUtil;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final JwtUtil jwtUtil;
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

    public AuthService(UserRepository userRepository, JwtUtil jwtUtil) {
        this.userRepository = userRepository;
        this.jwtUtil = jwtUtil;
    }

    @Transactional
    public AuthDtos.SessionResponse register(AuthDtos.RegisterRequest req) {
        // 短信验证码暂未接入，先使用固定验证码
        if (!"123456".equals(req.code())) {
            throw ApiException.badRequest("验证码错误");
        }
        String name = req.username() == null ? "" : req.username().trim();
        if (name.length() < 2 || name.length() > 32) {
            throw ApiException.badRequest("用户名长度需在 2-32 位之间");
        }
        if (req.phone() == null || !req.phone().matches("^1\\d{10}$")) {
            throw ApiException.badRequest("请输入正确的 11 位手机号");
        }
        if (req.password() == null || req.password().length() < 6 || req.password().length() > 64) {
            throw ApiException.badRequest("密码长度需在 6-64 位之间");
        }
        if (userRepository.existsByUsername(name)) {
            throw ApiException.conflict("该用户名已注册");
        }
        if (userRepository.existsByPhone(req.phone())) {
            throw ApiException.conflict("该手机号已注册");
        }
        User user = new User();
        user.setUsername(name);
        user.setPhone(req.phone());
        user.setPasswordHash(encoder.encode(req.password()));
        userRepository.save(user);
        return session(user);
    }

    public AuthDtos.SessionResponse login(AuthDtos.LoginRequest req) {
        String name = req.username() == null ? "" : req.username().trim();
        User user = userRepository.findByUsername(name).orElse(null);
        // 统一提示「用户名或密码错误」，不暴露账号是否存在
        if (user == null || !encoder.matches(req.password(), user.getPasswordHash())) {
            throw ApiException.badRequest("用户名或密码错误");
        }
        return session(user);
    }

    @Transactional
    public AuthDtos.SessionResponse resetPassword(AuthDtos.ResetRequest req) {
        if (req.password() == null || req.password().length() < 6 || req.password().length() > 64) {
            throw ApiException.badRequest("密码长度需在 6-64 位之间");
        }
        User user = userRepository.findByUsername(req.username() == null ? "" : req.username().trim())
                .orElseThrow(() -> ApiException.badRequest("账号不存在"));
        if (!user.getPhone().equals(req.phone())) {
            throw ApiException.badRequest("手机号与账号不匹配");
        }
        user.setPasswordHash(encoder.encode(req.password()));
        return session(user);
    }

    private AuthDtos.SessionResponse session(User user) {
        return new AuthDtos.SessionResponse(
                user.getUsername(), user.getPhone(), System.currentTimeMillis(), jwtUtil.issue(user.getUsername()));
    }
}

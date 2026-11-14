package com.leafrpa.service.common;

import com.leafrpa.service.user.User;
import com.leafrpa.service.user.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.MethodParameter;
import org.springframework.lang.NonNull;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.Arrays;
import java.util.List;

/**
 * Web 配置：CORS + @CurrentUser 参数解析器。
 * <p>登录态通过 Authorization: Bearer &lt;jwt&gt; 传入，@CurrentUser 直接拿到 User 实体；
 * 标注 required=false 的接口允许匿名访问（此时注入 null）。</p>
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final UserRepository userRepository;
    private final JwtUtil jwtUtil;

    /** 允许的跨域来源（逗号分隔）；留空时使用内置白名单 */
    private final String corsOrigins;

    public WebConfig(UserRepository userRepository,
                     JwtUtil jwtUtil,
                     @Value("${leaf.cors.origins:}") String corsOrigins) {
        this.userRepository = userRepository;
        this.jwtUtil = jwtUtil;
        this.corsOrigins = corsOrigins;
    }

    /**
     * CORS 收敛为白名单：生产入口 192.168.65.101、本机开发端口、Tauri 桌面壳来源。
     * 可通过环境变量 LEAF_CORS_ORIGINS（或 leaf.cors.origins）覆盖。
     */
    @Override
    public void addCorsMappings(@NonNull CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOriginPatterns(allowedOriginPatterns())
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .maxAge(3600);
    }

    private String[] allowedOriginPatterns() {
        String configured = corsOrigins == null ? "" : corsOrigins.trim();
        if (!configured.isEmpty()) {
            return Arrays.stream(configured.split(","))
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .toArray(String[]::new);
        }
        return new String[] {
                "http://192.168.65.101",
                "https://192.168.65.101",
                "http://192.168.65.101:*",
                "https://192.168.65.101:*",
                "http://localhost:*",
                "http://127.0.0.1:*",
                "tauri://localhost",
                "http://tauri.localhost",
                "http://tauri.localhost:*",
                "https://tauri.localhost:*",
        };
    }

    @Override
    public void addArgumentResolvers(@NonNull List<HandlerMethodArgumentResolver> resolvers) {
        resolvers.add(new CurrentUserResolver(userRepository, jwtUtil));
    }

    static class CurrentUserResolver implements HandlerMethodArgumentResolver {

        private final UserRepository userRepository;
        private final JwtUtil jwtUtil;

        CurrentUserResolver(UserRepository userRepository, JwtUtil jwtUtil) {
            this.userRepository = userRepository;
            this.jwtUtil = jwtUtil;
        }

        @Override
        public boolean supportsParameter(@NonNull MethodParameter parameter) {
            return parameter.hasParameterAnnotation(CurrentUser.class)
                    && User.class.isAssignableFrom(parameter.getParameterType());
        }

        @Override
        public Object resolveArgument(@NonNull MethodParameter parameter,
                                      ModelAndViewContainer mavContainer,
                                      @NonNull NativeWebRequest webRequest,
                                      WebDataBinderFactory binderFactory) {
            String auth = webRequest.getHeader("Authorization");
            boolean required = parameter.getParameterAnnotation(CurrentUser.class).required();
            if (auth == null || !auth.startsWith("Bearer ")) {
                if (required) {
                    throw ApiException.unauthorized("请先登录");
                }
                return null;
            }
            String username = jwtUtil.parse(auth.substring(7));
            if (username == null) {
                if (required) {
                    throw ApiException.unauthorized("登录已过期，请重新登录");
                }
                return null;
            }
            User user = userRepository.findByUsername(username).orElse(null);
            if (user == null && required) {
                throw ApiException.unauthorized("账号不存在");
            }
            return user;
        }
    }
}

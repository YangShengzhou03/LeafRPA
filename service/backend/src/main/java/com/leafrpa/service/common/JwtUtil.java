package com.leafrpa.service.common;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.Date;

/** 极简 JWT 签发与解析：subject = 用户名。 */
@Component
public class JwtUtil {

    private static final Logger log = LoggerFactory.getLogger(JwtUtil.class);

    /** 与 application.yml / docker-compose 中的开发默认密钥一致，用于启动时检测 */
    static final String DEV_DEFAULT_SECRET = "leaf-rpa-dev-secret-please-override-in-production-0123456789";

    private final Key key;
    private final long expireMs;

    public JwtUtil(@Value("${leaf.jwt.secret}") String secret,
                   @Value("${leaf.jwt.expire-hours}") long expireHours) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expireMs = expireHours * 3600_000L;
        if (DEV_DEFAULT_SECRET.equals(secret)) {
            log.warn("JWT 正在使用内置开发密钥（LEAF_JWT_SECRET 未设置）。"
                    + "生产环境必须通过环境变量 LEAF_JWT_SECRET 配置强随机密钥，否则令牌可被伪造。");
        }
    }

    public String issue(String username) {
        Date now = new Date();
        return Jwts.builder()
                .setSubject(username)
                .setIssuedAt(now)
                .setExpiration(new Date(now.getTime() + expireMs))
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    /** 解析并校验；失败返回 null。 */
    public String parse(String token) {
        try {
            Claims claims = Jwts.parserBuilder()
                    .setSigningKey(key)
                    .build()
                    .parseClaimsJws(token)
                    .getBody();
            return claims.getSubject();
        } catch (Exception e) {
            return null;
        }
    }
}

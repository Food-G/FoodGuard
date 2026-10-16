package com.foodguard.filter;

import com.foodguard.util.JwtUtil;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
@RequiredArgsConstructor
public class JwtFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        // 1. 요청 헤더에서 토큰 꺼내기
        String authHeader = request.getHeader("Authorization");

        if (authHeader != null && authHeader.startsWith("Bearer ")) {

            // 2. "Bearer " 제거하고 순수 토큰만 추출
            String token = authHeader.substring(7);

            // 3. 토큰 유효성 검사
            if (jwtUtil.validateToken(token)) {

                // 4. 토큰의 이메일·role로 인증 처리 (권한: ROLE_OWNER / ROLE_HQ_ADMIN)
                Claims claims = jwtUtil.getClaims(token);
                String role = claims.get("role", String.class);
                List<SimpleGrantedAuthority> authorities = role != null
                        ? List.of(new SimpleGrantedAuthority("ROLE_" + role))
                        : List.of();
                UsernamePasswordAuthenticationToken authentication =
                        new UsernamePasswordAuthenticationToken(
                                claims.getSubject(), null, authorities);

                // 매장 소유 확인용 사용자 id (StoreAccessService에서 사용)
                Number userId = claims.get("id", Number.class);
                authentication.setDetails(userId != null ? userId.longValue() : null);

                SecurityContextHolder.getContext().setAuthentication(authentication);
            }
        }

        // 5. 다음 필터로 넘기기
        filterChain.doFilter(request, response);
    }
}
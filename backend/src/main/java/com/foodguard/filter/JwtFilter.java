package com.foodguard.filter;

import com.foodguard.security.AuthUser;
import com.foodguard.util.JwtUtil;
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
import java.util.Collections;
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

                // 4. 토큰에서 이메일·역할·id 꺼내서 인증 처리
                //    role 클레임을 ROLE_ 권한으로 등록해야 @PreAuthorize 가 동작하고,
                //    principal 의 id 는 StoreAccessGuard 의 매장 소유권 검사에 쓰인다
                String email = jwtUtil.getEmail(token);
                String role = jwtUtil.getRole(token);
                Long userId = jwtUtil.getUserId(token);
                AuthUser principal = new AuthUser(userId, email, role);
                UsernamePasswordAuthenticationToken authentication =
                        new UsernamePasswordAuthenticationToken(
                                principal, null,
                                role != null
                                        ? List.of(new SimpleGrantedAuthority("ROLE_" + role))
                                        : Collections.emptyList());

                SecurityContextHolder.getContext().setAuthentication(authentication);
            }
        }

        // 5. 다음 필터로 넘기기
        filterChain.doFilter(request, response);
    }
}
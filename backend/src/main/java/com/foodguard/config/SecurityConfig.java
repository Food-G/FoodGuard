package com.foodguard.config;

import com.foodguard.filter.JwtFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.core.Authentication;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import jakarta.servlet.http.HttpServletRequest;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity  // @PreAuthorize 활성화
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtFilter jwtFilter;

    @Bean
    public BCryptPasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configure(http))
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
                )
                // 로그인 안 함·만료 토큰은 401 (프론트가 로그인 화면으로 보낸다). 권한 부족은 403
                .exceptionHandling(e -> e.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/auth/**", "/api/health").permitAll()
                        .requestMatchers("/api/delivery/**").permitAll()
                        .requestMatchers("/api/orders/scan").permitAll()
                        .requestMatchers("/api/orders/driver-scan").permitAll()
                        .requestMatchers("/api/orders/owner-scan").permitAll()
                        .requestMatchers("/ws/**").permitAll()
                        .requestMatchers("/error").permitAll()
                        // 본사 전용: 전체 발주·통계·전 매장 매출·매장 목록, 발주 승인/거절/발송
                        // 에이전트 계정(본사 발주 심사 등)은 본사 조회만 같이 쓴다
                        .requestMatchers(HttpMethod.GET, "/api/orders/admin/**", "/api/stats/**", "/api/sales/all-stores/**", "/api/stores")
                                .hasAnyRole("HQ_ADMIN", "AGENT")
                        .requestMatchers("/api/orders/admin/**", "/api/stats/**", "/api/sales/all-stores/**").hasRole("HQ_ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/orders/*/status").hasRole("HQ_ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/orders/*/hq-send").hasRole("HQ_ADMIN")
                        // 나머지는 로그인 + 매장 소유 검사 (security.StoreAccessInterceptor·StoreAccessBodyAdvice)
                        // AGENT 계정은 조회와 제안·실행기록 쓰기만 (isAllowed)
                        .anyRequest().access((authentication, ctx) ->
                                new AuthorizationDecision(isAllowed(authentication.get(), ctx.getRequest())))
                )
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    /**
     * 인증 필수 + AGENT 쓰기 제한 (DEV_ROADMAP R5).
     * AGENT 계정은 조회(GET)와 제안·실행기록 쓰기만 할 수 있다. 업무 데이터 쓰기는
     * 컨트롤러마다 막지 않고 여기 한 곳에서 막는다 (새 쓰기 API 가 생겨도 기본 거부).
     */
    private static boolean isAllowed(Authentication auth, HttpServletRequest request) {
        if (auth == null || !auth.isAuthenticated() || auth instanceof AnonymousAuthenticationToken) return false;
        boolean agent = auth.getAuthorities().stream().anyMatch(a -> "ROLE_AGENT".equals(a.getAuthority()));
        if (!agent) return true;

        String method = request.getMethod();
        String path = request.getRequestURI().substring(request.getContextPath().length());
        if ("GET".equals(method)) return true;
        return ("POST".equals(method) && (path.equals("/api/agent/proposals") || path.equals("/api/agent/runs")
                        // 사람 승인 없이 허용되는 직접 쓰기 (§4.3): 알림(24h 중복 금지), 재예측(매장당 하루 3회),
                        // 챌린저 학습(매장당 하루 1회, 운영 모델은 바뀌지 않음)
                        || path.equals("/api/notifications") || path.matches("/api/predictions/\\d+/(trigger|challenger)")))
                || ("PUT".equals(method) && path.startsWith("/api/agent/runs/"));
    }
}
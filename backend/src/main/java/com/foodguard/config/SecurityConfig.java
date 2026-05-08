package com.foodguard.config;

import com.foodguard.filter.JwtFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
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
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
                )
                .authorizeHttpRequests(auth -> auth
                        // API 인증 없이 허용
                        .requestMatchers("/api/auth/**", "/api/health").permitAll()
                        // 정적 파일 및 SPA 라우팅 허용
                        .requestMatchers("/", "/index.html", "/assets/**", "/*.js", "/*.css",
                                "/*.ico", "/*.png", "/*.svg", "/favicon.*", "/LOGO.png",
                                "/Logo-with-text.png", "/icons.svg").permitAll()
                        // API는 토큰 필요
                        .requestMatchers("/api/**").authenticated()
                        // 나머지 SPA 경로 허용
                        .anyRequest().permitAll()
                )
                // JwtFilter를 Security 필터 앞에 등록
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
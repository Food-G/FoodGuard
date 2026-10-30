package com.foodguard.config;

import com.foodguard.filter.JwtFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
@Configuration
@EnableWebSecurity
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
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers("/api/delivery/**").permitAll()
                        .requestMatchers("/api/orders/scan").permitAll()
                        .requestMatchers("/api/orders/driver-scan").permitAll()
                        .requestMatchers("/api/orders/owner-scan").permitAll()
                        .requestMatchers("/ws/**").permitAll()
                        .requestMatchers("/error").permitAll()
                        // 본사 전용: 전체 발주·통계·전 매장 매출·매장 목록, 발주 승인/거절/발송
                        .requestMatchers("/api/orders/admin/**", "/api/stats/**", "/api/sales/all-stores/**").hasRole("HQ_ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/stores").hasRole("HQ_ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/orders/*/status").hasRole("HQ_ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/orders/*/hq-send").hasRole("HQ_ADMIN")
                        // 나머지는 로그인 + 매장 소유 검사 (security.StoreAccessInterceptor·StoreAccessBodyAdvice)
                        .anyRequest().authenticated()
                )
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
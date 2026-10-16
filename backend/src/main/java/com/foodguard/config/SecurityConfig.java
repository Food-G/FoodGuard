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
                        .requestMatchers("/ws/**").permitAll()
                        .requestMatchers("/error").permitAll()
                        // 본사 전용 API (발주 승인·반려는 OrderRequestController에서 확인)
                        .requestMatchers(HttpMethod.GET, "/api/orders/admin/all").hasRole("HQ_ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/orders/*/hq-send").hasRole("HQ_ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/stores").hasRole("HQ_ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/stores/*").hasRole("HQ_ADMIN")
                        .anyRequest().authenticated()
                )
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
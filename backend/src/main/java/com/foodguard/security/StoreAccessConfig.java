package com.foodguard.security;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
@RequiredArgsConstructor
public class StoreAccessConfig implements WebMvcConfigurer {

    private final StoreAccessInterceptor storeAccessInterceptor;
    private final AiRateLimitInterceptor aiRateLimitInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(storeAccessInterceptor).addPathPatterns("/api/**");
        registry.addInterceptor(aiRateLimitInterceptor).addPathPatterns(AiRateLimitInterceptor.PATHS);
    }
}

package com.foodguard.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

@Configuration
public class AppConfig {

    /** ai-service 와의 공유 비밀. 비어 있으면 헤더를 붙이지 않는다 (ai-service 개발 모드). */
    @Value("${ai.service.token:}")
    private String aiServiceToken;

    @Bean
    public RestTemplate restTemplate() {
        RestTemplate restTemplate = new RestTemplate();
        restTemplate.getInterceptors().add((request, body, execution) -> {
            if (!aiServiceToken.isEmpty()) {
                request.getHeaders().set("X-Internal-Token", aiServiceToken);
            }
            return execution.execute(request, body);
        });
        return restTemplate;
    }
}

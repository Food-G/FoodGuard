package com.foodguard.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;

@Configuration
public class AppConfig {

    @Bean
    public RestTemplate restTemplate(RestTemplateBuilder builder, @Value("${ai.service.key:}") String aiServiceKey) {
        // HTTP/1.1 클라이언트로 고정: 기본 JDK HttpClient 는 평문 HTTP 에서 h2c 업그레이드를 시도하는데,
        // AI 서비스(uvicorn)가 그 요청의 본문을 버려 POST 본문이 비어 도착한다(422)
        return builder
                .requestFactory(SimpleClientHttpRequestFactory.class)
                .connectTimeout(Duration.ofSeconds(5))
                .readTimeout(Duration.ofSeconds(60))
                // 이 RestTemplate 은 AI 서비스 호출에만 쓴다. 키는 AI 서비스 INTERNAL_API_KEY 와 같은 값
                .defaultHeader("X-Internal-Key", aiServiceKey)
                .build();
    }
}

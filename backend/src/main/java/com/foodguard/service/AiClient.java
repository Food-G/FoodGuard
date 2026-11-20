package com.foodguard.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

/**
 * AI 서비스의 에이전트 API 호출. AI 서비스가 400 으로 알려 준 이유(파일 형식 등)는 그대로 전달한다.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AiClient {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${ai.service.url:http://localhost:8000}")
    private String aiServiceUrl;

    @SuppressWarnings("unchecked")
    public Map<String, Object> post(String path, Object body) {
        try {
            return restTemplate.postForObject(aiServiceUrl + path, body, Map.class);
        } catch (HttpClientErrorException.BadRequest e) {
            throw new RuntimeException(detail(e), e);
        } catch (RestClientException e) {
            log.warn("AI 서비스 호출 실패 ({}): {}", path, e.getMessage());
            throw new RuntimeException("AI 처리에 실패했습니다. AI 서비스와 claude CLI 로그인 상태를 확인하세요.");
        }
    }

    private String detail(HttpClientErrorException e) {
        try {
            JsonNode detail = objectMapper.readTree(e.getResponseBodyAsString()).get("detail");
            if (detail != null && detail.isTextual()) return detail.asText();
        } catch (Exception ignored) {
            // 본문이 JSON 이 아니면 아래 기본 문구
        }
        return "AI 서비스가 요청을 처리하지 못했습니다.";
    }
}

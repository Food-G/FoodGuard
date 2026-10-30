package com.foodguard.service;

import com.foodguard.repository.StoreRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 발주 추천 근거 설명: recommend() 결과(숫자와 계산 근거)를 AI 서비스(/api/explain/order, claude CLI)로 보내
 * 식자재별 설명 문장을 받는다. 발주량은 바꾸지 않는다.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OrderExplainService {

    private final OrderRequestService orderRequestService;
    private final StoreRepository storeRepository;
    private final RestTemplate restTemplate;

    @Value("${ai.service.url:http://localhost:8000}")
    private String aiServiceUrl;

    public Map<String, Object> explain(Long storeId) {
        List<Map<String, Object>> items = orderRequestService.recommend(storeId);
        Map<String, Object> body = new HashMap<>();
        body.put("storeName", storeRepository.findById(storeId).map(s -> s.getStoreName()).orElse(null));
        body.put("items", items);
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> explanation = restTemplate.postForObject(aiServiceUrl + "/api/explain/order", body, Map.class);
            return Map.of("recommendations", items, "explanation", explanation);
        } catch (RestClientException e) {
            log.warn("AI 근거 설명 호출 실패 (store {}): {}", storeId, e.getMessage());
            throw new RuntimeException("AI 근거 설명을 만들지 못했습니다. AI 서비스와 claude CLI 로그인 상태를 확인하세요.");
        }
    }
}

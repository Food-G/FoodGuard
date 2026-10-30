package com.foodguard.service;

import com.foodguard.dto.PredictionResultDto;
import com.foodguard.repository.PredictionResultRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class PredictionService {

    private final PredictionResultRepository predictionResultRepository;
    private final RestTemplate restTemplate;

    @Value("${ai.service.url:http://localhost:8000}")
    private String aiServiceUrl;

    public Map<String, Object> triggerPrediction(Long storeId) {
        String url = aiServiceUrl + "/api/predict/store/" + storeId;
        try {
            Map<?, ?> response = restTemplate.postForObject(url, null, Map.class);
            log.info("AI prediction triggered for store {}: {}", storeId, response);
            return Map.of("status", "success", "message", "Prediction complete", "storeId", storeId);
        } catch (Exception e) {
            log.error("Failed to trigger AI prediction for store {}: {}", storeId, e.getMessage());
            return Map.of("status", "error", "message", e.getMessage(), "storeId", storeId);
        }
    }

    public List<PredictionResultDto> getPredictions(Long storeId) {
        return predictionResultRepository
                .findByStore_IdAndPredictionDateGreaterThanEqualOrderByPredictionDateAsc(storeId, LocalDate.now())
                .stream()
                .map(PredictionResultDto::new)
                .collect(Collectors.toList());
    }

    public Map<String, Object> getSummary(Long storeId) {
        List<PredictionResultDto> predictions = getPredictions(storeId);

        // 메뉴별 그룹화
        Map<String, List<PredictionResultDto>> byMenu = predictions.stream()
                .collect(Collectors.groupingBy(
                        PredictionResultDto::getMenuName,
                        LinkedHashMap::new,
                        Collectors.toList()
                ));

        // 날짜 목록 추출
        List<String> dates = predictions.stream()
                .map(p -> p.getPredictionDate().toString())
                .distinct()
                .sorted()
                .collect(Collectors.toList());

        return Map.of(
                "storeId", storeId,
                "dates", dates,
                "byMenu", byMenu,
                "total", predictions.size()
        );
    }
}

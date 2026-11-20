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
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
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

    // 예측 1회에 모델 학습 약 20~30초. 같은 매장 중복 실행을 막는다 (버튼 연타)
    private final Set<Long> running = ConcurrentHashMap.newKeySet();

    public Map<String, Object> triggerPrediction(Long storeId) {
        if (!running.add(storeId)) {
            throw new RuntimeException("이 매장의 예측이 이미 실행 중입니다. 잠시 후 확인해 주세요.");
        }
        String url = aiServiceUrl + "/api/predict/store/" + storeId;
        try {
            Map<?, ?> response = restTemplate.postForObject(url, null, Map.class);
            log.info("AI prediction triggered for store {}: {}", storeId, response);
            return Map.of("status", "success", "message", "Prediction complete", "storeId", storeId);
        } catch (Exception e) {
            log.error("Failed to trigger AI prediction for store {}: {}", storeId, e.getMessage());
            throw new RuntimeException("AI 예측을 실행하지 못했습니다. 잠시 후 다시 시도해 주세요.");
        } finally {
            running.remove(storeId);
        }
    }

    /** ai-service /api/accuracy 프록시 (읽기 전용). 내부 토큰은 RestTemplate 인터셉터가 붙인다. */
    public Map<?, ?> getAccuracy(String source, Long storeId, Integer windowDays) {
        String url = aiServiceUrl + "/api/accuracy?source=" + source
                + (storeId != null ? "&store_id=" + storeId : "")
                + (windowDays != null ? "&window_days=" + windowDays : "");
        return restTemplate.getForObject(url, Map.class);
    }

    // ── 모델 버전 관리 (AG-5) ────────────────────────────────────────

    public Map<?, ?> getModelStatus(Long storeId) {
        return restTemplate.getForObject(aiServiceUrl + "/api/train/store/" + storeId + "/status", Map.class);
    }

    /** 챌린저 학습·비교. 운영 모델은 바뀌지 않고, ai-service 가 매장당 하루 1회로 제한한다. */
    public Map<?, ?> trainChallenger(Long storeId) {
        return restTemplate.postForObject(aiServiceUrl + "/api/train/store/" + storeId + "?target=challenger", null, Map.class);
    }

    public Map<?, ?> promoteChallenger(Long storeId, String expect) {
        return restTemplate.postForObject(aiServiceUrl + "/api/train/store/" + storeId + "/promote?expect={expect}",
                null, Map.class, expect);
    }

    public Map<?, ?> rollbackModel(Long storeId, String to) {
        return restTemplate.postForObject(aiServiceUrl + "/api/train/store/" + storeId + "/rollback?to={to}",
                null, Map.class, to);
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

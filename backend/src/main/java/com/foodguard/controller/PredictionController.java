package com.foodguard.controller;

import com.foodguard.dto.PredictionResultDto;
import com.foodguard.service.PredictionService;
import com.foodguard.security.StoreAccessGuard;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@RestController
@RequestMapping("/api/predictions")
@RequiredArgsConstructor
public class PredictionController {

    private final PredictionService predictionService;
    private final StoreAccessGuard guard;

    /** 예측 정확도 (ai-service 프록시). storeId 생략(전 매장)은 HQ 만. */
    @GetMapping("/accuracy")
    public ResponseEntity<?> getAccuracy(@RequestParam(defaultValue = "backtest") String source,
                                         @RequestParam(required = false) Long storeId,
                                         @RequestParam(required = false) Integer windowDays) {
        if (!source.equals("backtest") && !source.equals("live")) {
            return ResponseEntity.badRequest().body(Map.of("message", "source 는 backtest 또는 live"));
        }
        if (storeId != null) {
            guard.assertCanAccessStore(storeId);
        } else if (!guard.currentUser().isHqAdmin() && !guard.currentUser().isAgent()) {
            throw new AccessDeniedException("전 매장 정확도는 본사만 조회할 수 있습니다.");
        }
        try {
            return ResponseEntity.ok(predictionService.getAccuracy(source, storeId, windowDays));
        } catch (RestClientException e) {
            return ResponseEntity.status(502).body(Map.of("status", "error", "message", e.getMessage()));
        }
    }

    /** 예측 모델 상태 (ai-service 프록시). */
    @GetMapping("/{storeId}/model-status")
    public ResponseEntity<?> getModelStatus(@PathVariable Long storeId) {
        guard.assertCanAccessStore(storeId);
        try {
            return ResponseEntity.ok(predictionService.getModelStatus(storeId));
        } catch (RestClientException e) {
            return ResponseEntity.status(502).body(Map.of("status", "error", "message", e.getMessage()));
        }
    }

    /** 챌린저 학습·비교. AGENT 직접 실행 허용(§4.3), 점주는 호출하지 않는다. 운영 모델 교체는 제안 → 본사 승인으로만. */
    @PostMapping("/{storeId}/challenger")
    public ResponseEntity<?> trainChallenger(@PathVariable Long storeId) {
        if (!guard.currentUser().isAgent() && !guard.currentUser().isHqAdmin()) {
            throw new AccessDeniedException("챌린저 학습은 본사·에이전트만 할 수 있습니다.");
        }
        guard.assertCanAccessStoreOrAgent(storeId);
        try {
            return ResponseEntity.ok(predictionService.trainChallenger(storeId));
        } catch (RestClientException e) {
            return ResponseEntity.status(502).body(Map.of("status", "error", "message", e.getMessage()));
        }
    }

    /** 승격 전 모델로 되돌린다. to = 승격 결과의 archived 시각. 본사만. */
    @PostMapping("/{storeId}/model/rollback")
    public ResponseEntity<?> rollbackModel(@PathVariable Long storeId, @RequestParam String to) {
        if (!guard.currentUser().isHqAdmin()) {
            throw new AccessDeniedException("모델 되돌리기는 본사만 할 수 있습니다.");
        }
        try {
            return ResponseEntity.ok(predictionService.rollbackModel(storeId, to));
        } catch (HttpClientErrorException e) {
            return ResponseEntity.status(e.getStatusCode()).body(Map.of("status", "error", "message", e.getMessage()));
        } catch (RestClientException e) {
            return ResponseEntity.status(502).body(Map.of("status", "error", "message", e.getMessage()));
        }
    }

    @GetMapping("/{storeId}")
    public ResponseEntity<List<PredictionResultDto>> getPredictions(@PathVariable Long storeId) {
        guard.assertCanAccessStore(storeId);
        return ResponseEntity.ok(predictionService.getPredictions(storeId));
    }

    // 에이전트 재예측 한도: 매장당 하루 3회 (DEV_ROADMAP §4.3). 서버 재시작 시 초기화된다
    private static final int AGENT_TRIGGER_DAILY_LIMIT = 3;
    private final Map<String, AtomicInteger> agentTriggers = new ConcurrentHashMap<>();

    @PostMapping("/{storeId}/trigger")
    public ResponseEntity<Map<String, Object>> triggerPrediction(@PathVariable Long storeId) {
        guard.assertCanAccessStoreOrAgent(storeId);
        if (guard.currentUser().isAgent()) {
            String key = LocalDate.now() + ":" + storeId;
            agentTriggers.keySet().removeIf(k -> !k.startsWith(LocalDate.now() + ":"));
            if (agentTriggers.computeIfAbsent(key, k -> new AtomicInteger()).incrementAndGet() > AGENT_TRIGGER_DAILY_LIMIT) {
                return ResponseEntity.status(429).body(Map.of("status", "error",
                        "message", "에이전트 재예측 한도(매장당 하루 " + AGENT_TRIGGER_DAILY_LIMIT + "회)를 넘었습니다."));
            }
        }
        Map<String, Object> result = predictionService.triggerPrediction(storeId);
        // AI 서비스 호출 실패는 게이트웨이 오류로 알린다 (본문 형식은 그대로)
        if ("error".equals(result.get("status"))) {
            return ResponseEntity.status(502).body(result);
        }
        return ResponseEntity.ok(result);
    }

    @GetMapping("/{storeId}/summary")
    public ResponseEntity<Map<String, Object>> getSummary(@PathVariable Long storeId) {
        guard.assertCanAccessStore(storeId);
        return ResponseEntity.ok(predictionService.getSummary(storeId));
    }
}

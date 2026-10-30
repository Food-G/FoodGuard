package com.foodguard.controller;

import com.foodguard.dto.PredictionResultDto;
import com.foodguard.service.PredictionService;
import com.foodguard.security.StoreAccessGuard;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/predictions")
@RequiredArgsConstructor
public class PredictionController {

    private final PredictionService predictionService;
    private final StoreAccessGuard guard;

    /** 예측 정확도 (ai-service 프록시). storeId 생략(전 매장)은 HQ 만. */
    @GetMapping("/accuracy")
    public ResponseEntity<?> getAccuracy(@RequestParam(defaultValue = "backtest") String source,
                                         @RequestParam(required = false) Long storeId) {
        if (!source.equals("backtest") && !source.equals("live")) {
            return ResponseEntity.badRequest().body(Map.of("message", "source 는 backtest 또는 live"));
        }
        if (storeId != null) {
            guard.assertCanAccessStore(storeId);
        } else if (!guard.currentUser().isHqAdmin()) {
            throw new AccessDeniedException("전 매장 정확도는 본사만 조회할 수 있습니다.");
        }
        try {
            return ResponseEntity.ok(predictionService.getAccuracy(source, storeId));
        } catch (RestClientException e) {
            return ResponseEntity.status(502).body(Map.of("status", "error", "message", e.getMessage()));
        }
    }

    @GetMapping("/{storeId}")
    public ResponseEntity<List<PredictionResultDto>> getPredictions(@PathVariable Long storeId) {
        guard.assertCanAccessStore(storeId);
        return ResponseEntity.ok(predictionService.getPredictions(storeId));
    }

    @PostMapping("/{storeId}/trigger")
    public ResponseEntity<Map<String, Object>> triggerPrediction(@PathVariable Long storeId) {
        guard.assertCanAccessStore(storeId);
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

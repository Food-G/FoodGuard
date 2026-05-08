package com.foodguard.controller;

import com.foodguard.entity.PredictionResult;
import com.foodguard.service.PredictionResultService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/predictions")
@RequiredArgsConstructor
public class PredictionResultController {

    private final PredictionResultService predictionResultService;

    // 예측 결과 저장 (AI 서버 연동)
    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        try {
            BigDecimal confidence = body.containsKey("confidence")
                    ? new BigDecimal(body.get("confidence").toString()) : null;
            return ResponseEntity.ok(predictionResultService.create(
                    Long.parseLong(body.get("storeId").toString()),
                    Long.parseLong(body.get("menuId").toString()),
                    LocalDate.parse(body.get("predictionDate").toString()),
                    Integer.parseInt(body.get("predictedQty").toString()),
                    confidence,
                    body.containsKey("modelVersion") ? body.get("modelVersion").toString() : "v1.0"
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // 단건 조회
    @GetMapping("/detail/{id}")
    public ResponseEntity<?> getById(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(predictionResultService.getById(id));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // 가맹점별 예측 결과 전체 조회
    @GetMapping("/{storeId}")
    public ResponseEntity<List<PredictionResult>> getByStore(@PathVariable Long storeId) {
        return ResponseEntity.ok(predictionResultService.getByStore(storeId));
    }

    // 기간별 조회
    @GetMapping("/{storeId}/range")
    public ResponseEntity<List<PredictionResult>> getByDateRange(
            @PathVariable Long storeId,
            @RequestParam String start,
            @RequestParam String end) {
        return ResponseEntity.ok(predictionResultService.getByDateRange(
                storeId,
                LocalDate.parse(start),
                LocalDate.parse(end)
        ));
    }

    // 메뉴별 예측 조회
    @GetMapping("/{storeId}/menu/{menuId}")
    public ResponseEntity<List<PredictionResult>> getByMenu(
            @PathVariable Long storeId,
            @PathVariable Long menuId) {
        return ResponseEntity.ok(predictionResultService.getByMenu(storeId, menuId));
    }

    // 예측 결과 삭제
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(Map.of("message", predictionResultService.delete(id)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}

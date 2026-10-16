package com.foodguard.controller;

import com.foodguard.dto.PredictionResultDto;
import com.foodguard.service.PredictionService;
import com.foodguard.service.StoreAccessService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/predictions")
@RequiredArgsConstructor
public class PredictionController {

    private final PredictionService predictionService;
    private final StoreAccessService storeAccessService;

    @GetMapping("/{storeId}")
    public ResponseEntity<List<PredictionResultDto>> getPredictions(@PathVariable Long storeId) {
        storeAccessService.checkStore(storeId);
        return ResponseEntity.ok(predictionService.getPredictions(storeId));
    }

    @PostMapping("/{storeId}/trigger")
    public ResponseEntity<Map<String, Object>> triggerPrediction(@PathVariable Long storeId) {
        storeAccessService.checkStore(storeId);
        return ResponseEntity.ok(predictionService.triggerPrediction(storeId));
    }

    @GetMapping("/{storeId}/summary")
    public ResponseEntity<Map<String, Object>> getSummary(@PathVariable Long storeId) {
        storeAccessService.checkStore(storeId);
        return ResponseEntity.ok(predictionService.getSummary(storeId));
    }
}

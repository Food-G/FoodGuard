package com.foodguard.controller;

import com.foodguard.service.StoreAccessService;
import com.foodguard.service.WastePredictionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/waste-prediction")
@RequiredArgsConstructor
public class WastePredictionController {

    private final WastePredictionService wastePredictionService;
    private final StoreAccessService storeAccessService;

    @GetMapping("/{storeId}")
    public ResponseEntity<List<Map<String, Object>>> predict(@PathVariable Long storeId) {
        storeAccessService.checkStore(storeId);
        return ResponseEntity.ok(wastePredictionService.predict(storeId));
    }

    @GetMapping("/{storeId}/summary")
    public ResponseEntity<Map<String, Object>> summary(@PathVariable Long storeId) {
        storeAccessService.checkStore(storeId);
        return ResponseEntity.ok(wastePredictionService.summary(storeId));
    }
}

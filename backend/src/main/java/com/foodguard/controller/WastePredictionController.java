package com.foodguard.controller;

import com.foodguard.security.StoreAccessGuard;
import com.foodguard.service.InventoryLedger;
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
    private final StoreAccessGuard guard;
    private final InventoryLedger ledger;

    @GetMapping("/{storeId}")
    public ResponseEntity<?> predict(@PathVariable Long storeId) {
        guard.assertCanAccessStore(storeId);
        if (!ledger.isLotsEnabled()) return lotsMissing();
        List<Map<String, Object>> rows = wastePredictionService.predict(storeId).rows();
        return ResponseEntity.ok(rows);
    }

    @GetMapping("/{storeId}/summary")
    public ResponseEntity<?> summary(@PathVariable Long storeId) {
        guard.assertCanAccessStore(storeId);
        if (!ledger.isLotsEnabled()) return lotsMissing();
        return ResponseEntity.ok(wastePredictionService.summary(storeId));
    }

    private static ResponseEntity<Map<String, String>> lotsMissing() {
        return ResponseEntity.status(503).body(Map.of("message",
                "입고 로트가 아직 적용되지 않았습니다 (004_inventory_lot.sql 적용 후 서버 재시작)."));
    }
}

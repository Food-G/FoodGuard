package com.foodguard.controller;

import com.foodguard.entity.WasteRecord;
import com.foodguard.security.StoreAccessGuard;
import com.foodguard.service.InventoryLedger;
import com.foodguard.service.WasteService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/waste")
@RequiredArgsConstructor
public class WasteController {

    private final WasteService wasteService;
    private final StoreAccessGuard guard;
    private final InventoryLedger ledger;

    @PostMapping("/{storeId}")
    public ResponseEntity<WasteRecord> create(@PathVariable Long storeId, @RequestBody Map<String, Object> body) {
        guard.assertCanAccessStore(storeId);
        return ResponseEntity.ok(wasteService.record(
                storeId,
                Long.parseLong(body.get("ingredientId").toString()),
                Double.parseDouble(body.get("quantity").toString()),
                String.valueOf(body.get("reason"))
        ));
    }

    /** 폐기 기록 (최신순). 기간 기본값: 최근 30일, to 는 그날 포함. */
    @GetMapping("/{storeId}")
    public ResponseEntity<List<WasteRecord>> list(@PathVariable Long storeId,
                                                  @RequestParam(required = false) String from,
                                                  @RequestParam(required = false) String to) {
        guard.assertCanAccessStore(storeId);
        LocalDate end = to != null ? LocalDate.parse(to) : LocalDate.now();
        LocalDate start = from != null ? LocalDate.parse(from) : end.minusDays(29);
        return ResponseEntity.ok(wasteService.search(storeId, start, end));
    }

    /** 식자재별 폐기율 (원장 기준). 기간 기본값: 최근 30일. */
    @GetMapping("/{storeId}/rate")
    public ResponseEntity<?> rate(@PathVariable Long storeId,
                                  @RequestParam(required = false) String from,
                                  @RequestParam(required = false) String to) {
        guard.assertCanAccessStore(storeId);
        if (!ledger.isEnabled()) {
            return ResponseEntity.status(503).body(Map.of("message",
                    "재고 원장이 아직 적용되지 않았습니다 (003_inventory_txn.sql 적용 후 서버 재시작)."));
        }
        LocalDate end = to != null ? LocalDate.parse(to) : LocalDate.now();
        LocalDate start = from != null ? LocalDate.parse(from) : end.minusDays(29);
        return ResponseEntity.ok(wasteService.wasteRate(storeId, start, end));
    }
}

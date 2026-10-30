package com.foodguard.controller;

import com.foodguard.entity.Inventory;
import com.foodguard.repository.InventoryTxnRepository;
import com.foodguard.service.InventoryLedger;
import com.foodguard.service.InventoryService;
import com.foodguard.security.StoreAccessGuard;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/inventory")
@RequiredArgsConstructor
public class InventoryController {

    private final InventoryService inventoryService;
    private final StoreAccessGuard guard;
    private final InventoryLedger ledger;
    private final InventoryTxnRepository txnRepository;

    @PostMapping
    public ResponseEntity<Inventory> create(@RequestBody Map<String, Object> body) {
        Long storeId = Long.parseLong(body.get("storeId").toString());
        guard.assertCanAccessStore(storeId);
        return ResponseEntity.ok(inventoryService.create(
                storeId,
                Long.parseLong(body.get("ingredientId").toString()),
                Double.parseDouble(body.get("quantity").toString())
        ));
    }

    @GetMapping("/{storeId}")
    public ResponseEntity<List<Inventory>> getByStore(@PathVariable Long storeId) {
        guard.assertCanAccessStore(storeId);
        return ResponseEntity.ok(inventoryService.getByStore(storeId));
    }

    /** 재고 원장 조회 (최신순, 최대 500건). 기간 기본값: 최근 30일, to 는 그날 포함. */
    @GetMapping("/{storeId}/txns")
    public ResponseEntity<?> getTxns(@PathVariable Long storeId,
                                     @RequestParam(required = false) String from,
                                     @RequestParam(required = false) String to,
                                     @RequestParam(required = false) Long ingredientId) {
        guard.assertCanAccessStore(storeId);
        if (!ledger.isEnabled()) {
            return ResponseEntity.status(503).body(Map.of("message",
                    "재고 원장이 아직 적용되지 않았습니다 (003_inventory_txn.sql 적용 후 서버 재시작)."));
        }
        LocalDate end = to != null ? LocalDate.parse(to) : LocalDate.now();
        LocalDate start = from != null ? LocalDate.parse(from) : end.minusDays(29);
        return ResponseEntity.ok(txnRepository.search(storeId, start.atStartOfDay(),
                end.plusDays(1).atStartOfDay(), ingredientId));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Inventory> update(@PathVariable Long id,
                                            @RequestBody Map<String, Object> body) {
        guard.assertCanAccessInventory(id);
        return ResponseEntity.ok(inventoryService.update(
                id,
                Double.parseDouble(body.get("quantity").toString())
        ));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<String> delete(@PathVariable Long id) {
        guard.assertCanAccessInventory(id);
        return ResponseEntity.ok(inventoryService.delete(id));
    }

    @DeleteMapping("/store/{storeId}")
    public ResponseEntity<String> deleteAll(@PathVariable Long storeId) {
        guard.assertCanAccessStore(storeId);
        return ResponseEntity.ok(inventoryService.deleteAll(storeId));
    }
}
package com.foodguard.controller;

import com.foodguard.entity.Inventory;
import com.foodguard.service.InventoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/inventory")
@RequiredArgsConstructor
public class InventoryController {

    private final InventoryService inventoryService;

    // 재고 등록
    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        try {
            Long storeId = Long.parseLong(body.get("storeId").toString());
            Long ingredientId = Long.parseLong(body.get("ingredientId").toString());
            Double quantity = Double.parseDouble(body.get("quantity").toString());
            Double minThreshold = body.containsKey("minThreshold")
                    ? Double.parseDouble(body.get("minThreshold").toString()) : null;
            String unit = body.containsKey("unit") ? body.get("unit").toString() : null;
            return ResponseEntity.ok(inventoryService.create(storeId, ingredientId, quantity, minThreshold, unit));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // 간편 재고 등록 (재고명 → 식자재 자동생성 + 재고 생성)
    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, Object> body) {
        try {
            Long storeId = Long.parseLong(body.get("storeId").toString());
            String ingredientName = body.get("ingredientName").toString();
            Double quantity = Double.parseDouble(body.get("quantity").toString());
            BigDecimal price = body.containsKey("price")
                    ? new BigDecimal(body.get("price").toString()) : BigDecimal.ZERO;
            LocalDate expiryDate = body.containsKey("expiryDate") && body.get("expiryDate") != null
                    && !body.get("expiryDate").toString().isBlank()
                    ? LocalDate.parse(body.get("expiryDate").toString()) : null;
            String unit = body.containsKey("unit") ? body.get("unit").toString() : null;
            return ResponseEntity.ok(inventoryService.register(storeId, ingredientName, quantity, price, expiryDate, unit));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // 가맹점 재고 전체 조회
    @GetMapping("/{storeId}")
    public ResponseEntity<List<Inventory>> getByStore(@PathVariable Long storeId) {
        return ResponseEntity.ok(inventoryService.getByStore(storeId));
    }

    // 재고 부족 항목 조회
    @GetMapping("/{storeId}/low-stock")
    public ResponseEntity<List<Inventory>> getLowStock(@PathVariable Long storeId) {
        return ResponseEntity.ok(inventoryService.getLowStock(storeId));
    }

    // 재고 수량 수정
    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id,
                                    @RequestBody Map<String, Object> body) {
        try {
            return ResponseEntity.ok(inventoryService.update(
                    id,
                    Double.parseDouble(body.get("quantity").toString())
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

<<<<<<< HEAD
    @DeleteMapping("/store/{storeId}")
    public ResponseEntity<String> deleteAll(@PathVariable Long storeId) {
        return ResponseEntity.ok(inventoryService.deleteAll(storeId));
    }
}
=======
    // 최소 임계값 수정
    @PatchMapping("/{id}/threshold")
    public ResponseEntity<?> updateThreshold(@PathVariable Long id,
                                             @RequestBody Map<String, Object> body) {
        try {
            return ResponseEntity.ok(inventoryService.updateThreshold(
                    id,
                    Double.parseDouble(body.get("minThreshold").toString())
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // 재고 삭제
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(Map.of("message", inventoryService.delete(id)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
>>>>>>> 233f87c (feat: CRUD 완성 및 FoodGuard UI 전면 개선)

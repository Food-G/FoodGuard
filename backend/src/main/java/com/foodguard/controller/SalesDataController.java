package com.foodguard.controller;

import com.foodguard.entity.SalesData;
import com.foodguard.service.SalesDataService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/sales")
@RequiredArgsConstructor
public class SalesDataController {

    private final SalesDataService salesDataService;

    // 매출 등록
    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        try {
            return ResponseEntity.ok(salesDataService.create(
                    Long.parseLong(body.get("storeId").toString()),
                    Long.parseLong(body.get("menuId").toString()),
                    Integer.parseInt(body.get("quantity").toString()),
                    body.containsKey("totalPrice") ? Integer.parseInt(body.get("totalPrice").toString()) : 0,
                    body.containsKey("saleDate")
                            ? LocalDate.parse(body.get("saleDate").toString())
                            : LocalDate.now()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // 가맹점 매출 전체 조회
    @GetMapping("/{storeId}")
    public ResponseEntity<List<SalesData>> getByStore(@PathVariable Long storeId) {
        return ResponseEntity.ok(salesDataService.getByStore(storeId));
    }

    // 기간별 조회
    @GetMapping("/{storeId}/range")
    public ResponseEntity<List<SalesData>> getByDateRange(
            @PathVariable Long storeId,
            @RequestParam String start,
            @RequestParam String end) {
        return ResponseEntity.ok(salesDataService.getByDateRange(
                storeId,
                LocalDate.parse(start),
                LocalDate.parse(end)
        ));
    }

    // 매출 수정
    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id,
                                    @RequestBody Map<String, Object> body) {
        try {
            return ResponseEntity.ok(salesDataService.update(
                    id,
                    body.containsKey("quantity") ? Integer.parseInt(body.get("quantity").toString()) : null,
                    body.containsKey("totalPrice") ? Integer.parseInt(body.get("totalPrice").toString()) : null,
                    body.containsKey("saleDate") ? LocalDate.parse(body.get("saleDate").toString()) : null
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

<<<<<<< HEAD
    @GetMapping("/{storeId}/today-summary")
    public ResponseEntity<Map<String, Object>> getTodaySummary(@PathVariable Long storeId) {
        return ResponseEntity.ok(salesDataService.getTodaySummary(storeId));
    }

    @GetMapping("/{storeId}/weekly-summary")
    public ResponseEntity<Map<String, Object>> getWeeklySummary(@PathVariable Long storeId) {
        return ResponseEntity.ok(salesDataService.getWeeklySummary(storeId));
    }

    @GetMapping("/all-stores/weekly-summary")
    public ResponseEntity<Map<Long, Long>> getAllStoreWeeklySummary() {
        return ResponseEntity.ok(salesDataService.getAllStoreWeeklySummary());
    }
}
=======
    // 매출 삭제 (Soft Delete)
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(Map.of("message", salesDataService.delete(id)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
>>>>>>> 233f87c (feat: CRUD 완성 및 FoodGuard UI 전면 개선)

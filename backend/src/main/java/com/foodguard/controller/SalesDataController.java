package com.foodguard.controller;

import com.foodguard.entity.SalesData;
import com.foodguard.service.SalesDataService;
import com.foodguard.security.StoreAccessGuard;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/sales")
@RequiredArgsConstructor
public class SalesDataController {

    private final SalesDataService salesDataService;
    private final StoreAccessGuard guard;

    @PostMapping
    public ResponseEntity<SalesData> create(@RequestBody Map<String, Object> body) {
        guard.assertCanAccessStore(Long.parseLong(body.get("storeId").toString()));
        return ResponseEntity.ok(salesDataService.create(
                Long.parseLong(body.get("storeId").toString()),
                Long.parseLong(body.get("menuId").toString()),
                Integer.parseInt(body.get("quantity").toString()),
                Integer.parseInt(body.get("totalPrice").toString()),
                LocalDate.parse(body.get("saleDate").toString())
        ));
    }

    @GetMapping("/{storeId}")
    public ResponseEntity<List<SalesData>> getByStore(@PathVariable Long storeId) {
        guard.assertCanAccessStore(storeId);
        return ResponseEntity.ok(salesDataService.getByStore(storeId));
    }

    @GetMapping("/{storeId}/range")
    public ResponseEntity<List<SalesData>> getByDateRange(
            @PathVariable Long storeId,
            @RequestParam String start,
            @RequestParam String end) {
        guard.assertCanAccessStore(storeId);
        return ResponseEntity.ok(salesDataService.getByDateRange(
                storeId,
                LocalDate.parse(start),
                LocalDate.parse(end)
        ));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<String> delete(@PathVariable Long id) {
        guard.assertCanAccessSales(id);
        return ResponseEntity.ok(salesDataService.delete(id));
    }

    @GetMapping("/{storeId}/today-summary")
    public ResponseEntity<Map<String, Object>> getTodaySummary(@PathVariable Long storeId) {
        guard.assertCanAccessStore(storeId);
        return ResponseEntity.ok(salesDataService.getTodaySummary(storeId));
    }

    @GetMapping("/{storeId}/weekly-summary")
    public ResponseEntity<Map<String, Object>> getWeeklySummary(@PathVariable Long storeId) {
        guard.assertCanAccessStore(storeId);
        return ResponseEntity.ok(salesDataService.getWeeklySummary(storeId));
    }

    @PreAuthorize("hasAnyRole('HQ_ADMIN', 'AGENT')")
    @GetMapping("/all-stores/weekly-summary")
    public ResponseEntity<Map<Long, Long>> getAllStoreWeeklySummary() {
        return ResponseEntity.ok(salesDataService.getAllStoreWeeklySummary());
    }
}
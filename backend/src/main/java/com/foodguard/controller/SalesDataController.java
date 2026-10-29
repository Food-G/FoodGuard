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

    @PostMapping
    public ResponseEntity<SalesData> create(@RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(salesDataService.create(
                Long.parseLong(body.get("storeId").toString()),
                Long.parseLong(body.get("menuId").toString()),
                Integer.parseInt(body.get("quantity").toString()),
                LocalDate.parse(body.get("saleDate").toString())
        ));
    }

    @GetMapping("/{storeId}")
    public ResponseEntity<List<SalesData>> getByStore(@PathVariable Long storeId) {
        return ResponseEntity.ok(salesDataService.getByStore(storeId));
    }

    @GetMapping("/all-stores/weekly-summary")
    public ResponseEntity<Map<Long, Long>> getAllStoreWeeklySummary() {
        return ResponseEntity.ok(salesDataService.getAllStoreWeeklySummary());
    }

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

    @DeleteMapping("/{id}")
    public ResponseEntity<String> delete(@PathVariable Long id) {
        return ResponseEntity.ok(salesDataService.delete(id));
    }
}
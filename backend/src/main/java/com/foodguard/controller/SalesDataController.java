package com.foodguard.controller;

import com.foodguard.entity.SalesData;
import com.foodguard.service.SalesDataService;
import com.foodguard.service.StoreAccessService;
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
    private final StoreAccessService storeAccessService;

    @PostMapping
    public ResponseEntity<SalesData> create(@RequestBody Map<String, Object> body) {
        Long storeId = Long.parseLong(body.get("storeId").toString());
        storeAccessService.checkStore(storeId);
        return ResponseEntity.ok(salesDataService.create(
                storeId,
                Long.parseLong(body.get("menuId").toString()),
                Integer.parseInt(body.get("quantity").toString()),
                LocalDate.parse(body.get("saleDate").toString())
        ));
    }

    @GetMapping("/{storeId}")
    public ResponseEntity<List<SalesData>> getByStore(@PathVariable Long storeId) {
        storeAccessService.checkStore(storeId);
        return ResponseEntity.ok(salesDataService.getByStore(storeId));
    }

    @GetMapping("/{storeId}/range")
    public ResponseEntity<List<SalesData>> getByDateRange(
            @PathVariable Long storeId,
            @RequestParam String start,
            @RequestParam String end) {
        storeAccessService.checkStore(storeId);
        return ResponseEntity.ok(salesDataService.getByDateRange(
                storeId,
                LocalDate.parse(start),
                LocalDate.parse(end)
        ));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<String> delete(@PathVariable Long id) {
        storeAccessService.checkStore(salesDataService.getById(id).getStore().getId());
        return ResponseEntity.ok(salesDataService.delete(id));
    }
}
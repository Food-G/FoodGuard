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

    @PostMapping
    public ResponseEntity<Inventory> create(@RequestBody Map<String, Object> body) {
        LocalDate expiryDate = body.get("expiryDate") != null
                ? LocalDate.parse(body.get("expiryDate").toString()) : null;
        return ResponseEntity.ok(inventoryService.create(
                Long.parseLong(body.get("storeId").toString()),
                body.get("ingredientName").toString(),
                body.get("unit").toString(),
                new BigDecimal(body.get("currentStock").toString()),
                body.get("thresholdStock") != null
                        ? new BigDecimal(body.get("thresholdStock").toString()) : null,
                expiryDate
        ));
    }

    @GetMapping("/{storeId}")
    public ResponseEntity<List<Inventory>> getByStore(@PathVariable Long storeId) {
        return ResponseEntity.ok(inventoryService.getByStore(storeId));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Inventory> update(@PathVariable Long id,
                                            @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(inventoryService.update(
                id,
                new BigDecimal(body.get("currentStock").toString()),
                body.get("wasteQuantity") != null
                        ? new BigDecimal(body.get("wasteQuantity").toString()) : BigDecimal.ZERO
        ));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<String> delete(@PathVariable Long id) {
        return ResponseEntity.ok(inventoryService.delete(id));
    }
}

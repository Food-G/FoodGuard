package com.foodguard.controller;

import com.foodguard.entity.Inventory;
import com.foodguard.service.InventoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/inventory")
@RequiredArgsConstructor
public class InventoryController {

    private final InventoryService inventoryService;

    @GetMapping("/{storeId}")
    public ResponseEntity<List<Inventory>> getByStore(@PathVariable Long storeId) {
        return ResponseEntity.ok(inventoryService.getByStore(storeId));
    }

    @DeleteMapping("/store/{storeId}")
    public ResponseEntity<String> deleteByStore(@PathVariable Long storeId) {
        return ResponseEntity.ok(inventoryService.deleteByStore(storeId));
    }
}
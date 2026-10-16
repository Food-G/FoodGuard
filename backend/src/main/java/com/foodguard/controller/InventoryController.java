package com.foodguard.controller;

import com.foodguard.entity.Inventory;
import com.foodguard.service.InventoryService;
import com.foodguard.security.StoreAccessGuard;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/inventory")
@RequiredArgsConstructor
public class InventoryController {

    private final InventoryService inventoryService;
    private final StoreAccessGuard guard;

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
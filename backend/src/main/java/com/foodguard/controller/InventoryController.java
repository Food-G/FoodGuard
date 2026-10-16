package com.foodguard.controller;

import com.foodguard.entity.Inventory;
import com.foodguard.service.InventoryService;
import com.foodguard.service.StoreAccessService;
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
    private final StoreAccessService storeAccessService;

    @PostMapping
    public ResponseEntity<Inventory> create(@RequestBody Map<String, Object> body) {
        Long storeId = Long.parseLong(body.get("storeId").toString());
        storeAccessService.checkStore(storeId);
        return ResponseEntity.ok(inventoryService.create(
                storeId,
                Long.parseLong(body.get("ingredientId").toString()),
                Double.parseDouble(body.get("quantity").toString())
        ));
    }

    @GetMapping("/{storeId}")
    public ResponseEntity<List<Inventory>> getByStore(@PathVariable Long storeId) {
        storeAccessService.checkStore(storeId);
        return ResponseEntity.ok(inventoryService.getByStore(storeId));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Inventory> update(@PathVariable Long id,
                                            @RequestBody Map<String, Object> body) {
        storeAccessService.checkStore(inventoryService.getById(id).getStore().getId());
        return ResponseEntity.ok(inventoryService.update(
                id,
                Double.parseDouble(body.get("quantity").toString())
        ));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<String> delete(@PathVariable Long id) {
        storeAccessService.checkStore(inventoryService.getById(id).getStore().getId());
        return ResponseEntity.ok(inventoryService.delete(id));
    }

    @DeleteMapping("/store/{storeId}")
    public ResponseEntity<String> deleteByStore(@PathVariable Long storeId) {
        storeAccessService.checkStore(storeId);
        return ResponseEntity.ok(inventoryService.deleteByStore(storeId));
    }
}
package com.foodguard.controller;

import com.foodguard.entity.Store;
import com.foodguard.service.StoreService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/stores")
@RequiredArgsConstructor
public class StoreController {

    private final StoreService storeService;

    @PostMapping
    public ResponseEntity<Store> create(@RequestBody Map<String, Object> body) {
        String region = body.containsKey("region") ? body.get("region").toString() : null;
        return ResponseEntity.ok(storeService.create(
                Long.parseLong(body.get("userId").toString()),
                body.get("storeName").toString(),
                body.get("address") != null ? body.get("address").toString() : "",
                body.get("phone") != null ? body.get("phone").toString() : "",
                region,
                null
        ));
    }
    @GetMapping("/my/{userId}")
    public ResponseEntity<List<Store>> getMyStores(@PathVariable Long userId) {
        return ResponseEntity.ok(storeService.getMyStores(userId));
    }

    @GetMapping
    public ResponseEntity<List<Store>> getAll() {
        return ResponseEntity.ok(storeService.getAll());
    }

    @PutMapping("/{id}")
    public ResponseEntity<Store> update(@PathVariable Long id,
                                        @RequestBody Map<String, Object> body) {
        String region = body.containsKey("region") ? body.get("region").toString() : null;
        return ResponseEntity.ok(storeService.update(
                id,
                body.get("storeName").toString(),
                body.get("address") != null ? body.get("address").toString() : "",
                body.get("phone") != null ? body.get("phone").toString() : "",
                region
        ));
    }
}
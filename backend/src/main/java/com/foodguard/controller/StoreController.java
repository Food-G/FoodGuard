package com.foodguard.controller;

import com.foodguard.entity.Store;
import com.foodguard.service.StoreService;
import com.foodguard.service.StoreAccessService;
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
    private final StoreAccessService storeAccessService;

    @PostMapping
    public ResponseEntity<Store> create(@RequestBody Map<String, Object> body) {
        String region = body.containsKey("region") ? body.get("region").toString() : null;
        Long userId = Long.parseLong(body.get("userId").toString());
        storeAccessService.checkUser(userId);
        return ResponseEntity.ok(storeService.create(
                userId,
                body.get("storeName").toString(),
                body.get("address") != null ? body.get("address").toString() : "",
                body.get("phone") != null ? body.get("phone").toString() : "",
                region,
                null
        ));
    }
    @GetMapping("/my/{userId}")
    public ResponseEntity<List<Store>> getMyStores(@PathVariable Long userId) {
        storeAccessService.checkUser(userId);
        return ResponseEntity.ok(storeService.getMyStores(userId));
    }

    @GetMapping
    public ResponseEntity<List<Store>> getAll() {
        return ResponseEntity.ok(storeService.getAll());
    }

    @PutMapping("/{id}")
    public ResponseEntity<Store> update(@PathVariable Long id,
                                        @RequestBody Map<String, Object> body) {
        storeAccessService.checkStore(id);
        String region = body.containsKey("region") ? body.get("region").toString() : null;
        return ResponseEntity.ok(storeService.update(
                id,
                body.get("storeName").toString(),
                body.get("address") != null ? body.get("address").toString() : "",
                body.get("phone") != null ? body.get("phone").toString() : "",
                region
        ));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<String> delete(@PathVariable Long id) {
        return ResponseEntity.ok(storeService.delete(id));
    }
}
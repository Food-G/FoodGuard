package com.foodguard.controller;

import com.foodguard.entity.Store;
import com.foodguard.service.StoreService;
import com.foodguard.security.StoreAccessGuard;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/stores")
@RequiredArgsConstructor
public class StoreController {

    private final StoreService storeService;
    private final StoreAccessGuard guard;

    @PostMapping
    public ResponseEntity<Store> create(@RequestBody Map<String, Object> body) {
        String region = body.containsKey("region") ? body.get("region").toString() : null;
        return ResponseEntity.ok(storeService.create(
                Long.parseLong(body.get("userId").toString()),
                body.get("storeName").toString(),
                body.get("address").toString(),
                body.get("phone").toString(),
                region
        ));
    }

    @GetMapping("/my/{userId}")
    public ResponseEntity<List<Store>> getMyStores(@PathVariable Long userId) {
        guard.assertIsSelf(userId);
        return ResponseEntity.ok(storeService.getMyStores(userId));
    }

    @PreAuthorize("hasRole('HQ_ADMIN')")
    @GetMapping
    public ResponseEntity<List<Store>> getAll() {
        return ResponseEntity.ok(storeService.getAll());
    }

    @PutMapping("/{id}")
    public ResponseEntity<Store> update(@PathVariable Long id,
                                        @RequestBody Map<String, Object> body) {
        guard.assertCanAccessStore(id);
        String region = body.containsKey("region") ? body.get("region").toString() : null;
        return ResponseEntity.ok(storeService.update(
                id,
                body.get("storeName").toString(),
                body.get("address").toString(),
                body.get("phone").toString(),
                region
        ));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<String> delete(@PathVariable Long id) {
        guard.assertCanAccessStore(id);
        return ResponseEntity.ok(storeService.delete(id));
    }
}
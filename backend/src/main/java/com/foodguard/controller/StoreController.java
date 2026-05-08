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

    // 가맹점 등록
    @PostMapping
<<<<<<< HEAD
    public ResponseEntity<Store> create(@RequestBody Map<String, Object> body) {
        String region = body.containsKey("region") ? body.get("region").toString() : null;
        return ResponseEntity.ok(storeService.create(
                Long.parseLong(body.get("userId").toString()),
                body.get("storeName").toString(),
                body.get("address").toString(),
                body.get("phone").toString(),
                region
        ));
=======
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        try {
            return ResponseEntity.ok(storeService.create(
                    Long.parseLong(body.get("userId").toString()),
                    body.get("storeName").toString(),
                    body.getOrDefault("address", "").toString(),
                    body.getOrDefault("phone", "").toString()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
>>>>>>> 233f87c (feat: CRUD 완성 및 FoodGuard UI 전면 개선)
    }

    // 단건 조회
    @GetMapping("/{id}")
    public ResponseEntity<?> getById(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(storeService.getById(id));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // 내 가맹점 목록
    @GetMapping("/my/{userId}")
    public ResponseEntity<List<Store>> getMyStores(@PathVariable Long userId) {
        return ResponseEntity.ok(storeService.getMyStores(userId));
    }

    // 전체 가맹점 (본사용)
    @GetMapping
    public ResponseEntity<List<Store>> getAll() {
        return ResponseEntity.ok(storeService.getAll());
    }

<<<<<<< HEAD
    @PutMapping("/{id}")
    public ResponseEntity<Store> update(@PathVariable Long id,
                                        @RequestBody Map<String, Object> body) {
        String region = body.containsKey("region") ? body.get("region").toString() : null;
        return ResponseEntity.ok(storeService.update(
                id,
                body.get("storeName").toString(),
                body.get("address").toString(),
                body.get("phone").toString(),
                region
        ));
=======
    // 지역별 조회
    @GetMapping("/region/{region}")
    public ResponseEntity<List<Store>> getByRegion(@PathVariable String region) {
        return ResponseEntity.ok(storeService.getByRegion(region));
>>>>>>> 233f87c (feat: CRUD 완성 및 FoodGuard UI 전면 개선)
    }

    // 활성 가맹점만 조회
    @GetMapping("/active")
    public ResponseEntity<List<Store>> getActiveStores() {
        return ResponseEntity.ok(storeService.getActiveStores());
    }

    // 가맹점 수정
    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id,
                                    @RequestBody Map<String, Object> body) {
        try {
            return ResponseEntity.ok(storeService.update(
                    id,
                    body.getOrDefault("storeName", null) != null ? body.get("storeName").toString() : null,
                    body.getOrDefault("address", null) != null ? body.get("address").toString() : null,
                    body.getOrDefault("phone", null) != null ? body.get("phone").toString() : null
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // 활성화 토글
    @PatchMapping("/{id}/active")
    public ResponseEntity<?> toggleActive(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(storeService.toggleActive(id));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // 가맹점 삭제
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(Map.of("message", storeService.delete(id)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}

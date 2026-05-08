package com.foodguard.controller;

import com.foodguard.entity.Menu;
import com.foodguard.service.MenuService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/menus")
@RequiredArgsConstructor
public class MenuController {

    private final MenuService menuService;

    // 메뉴 등록
    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        try {
            return ResponseEntity.ok(menuService.create(
                    Long.parseLong(body.get("storeId").toString()),
                    body.get("menuName").toString(),
                    Integer.parseInt(body.get("price").toString()),
                    body.getOrDefault("category", "").toString()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // 단건 조회
    @GetMapping("/detail/{id}")
    public ResponseEntity<?> getById(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(menuService.getById(id));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // 가맹점 메뉴 전체 조회 (비활성 포함)
    @GetMapping("/{storeId}/all")
    public ResponseEntity<List<Menu>> getAllMenus(@PathVariable Long storeId) {
        return ResponseEntity.ok(menuService.getAllMenus(storeId));
    }

    // 가맹점 활성 메뉴 조회
    @GetMapping("/{storeId}")
    public ResponseEntity<List<Menu>> getActiveMenus(@PathVariable Long storeId) {
        return ResponseEntity.ok(menuService.getActiveMenus(storeId));
    }

    // 메뉴 수정
    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id,
                                    @RequestBody Map<String, Object> body) {
        try {
            return ResponseEntity.ok(menuService.update(
                    id,
                    body.containsKey("menuName") ? body.get("menuName").toString() : null,
                    body.containsKey("price") ? Integer.parseInt(body.get("price").toString()) : null,
                    body.containsKey("category") ? body.get("category").toString() : null
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // 메뉴 활성화
    @PatchMapping("/{id}/activate")
    public ResponseEntity<?> activate(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(Map.of("message", menuService.activate(id)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // 메뉴 비활성화
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deactivate(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(Map.of("message", menuService.deactivate(id)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}

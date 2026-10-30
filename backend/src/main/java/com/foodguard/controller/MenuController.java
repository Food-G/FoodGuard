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

    @PostMapping
    public ResponseEntity<Menu> create(@RequestBody Map<String, Object> body) {
        String category = body.get("category") != null ? body.get("category").toString() : null;
        return ResponseEntity.ok(menuService.create(
                Long.parseLong(body.get("storeId").toString()),
                body.get("menuName").toString(),
                Integer.parseInt(body.get("price").toString()),
                category
        ));
    }

    @GetMapping("/{storeId}")
    public ResponseEntity<List<Menu>> getActiveMenus(@PathVariable Long storeId) {
        return ResponseEntity.ok(menuService.getActiveMenus(storeId));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Menu> update(@PathVariable Long id,
                                       @RequestBody Map<String, Object> body) {
        String category = body.get("category") != null ? body.get("category").toString() : null;
        return ResponseEntity.ok(menuService.update(
                id,
                body.get("menuName").toString(),
                Integer.parseInt(body.get("price").toString()),
                category
        ));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<String> deactivate(@PathVariable Long id) {
        return ResponseEntity.ok(menuService.deactivate(id));
    }
}
package com.foodguard.controller;

import com.foodguard.entity.Menu;
import com.foodguard.service.MenuService;
import com.foodguard.service.StoreAccessService;
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
    private final StoreAccessService storeAccessService;

    @PostMapping
    public ResponseEntity<Menu> create(@RequestBody Map<String, Object> body) {
        String category = body.get("category") != null ? body.get("category").toString() : null;
        Long storeId = Long.parseLong(body.get("storeId").toString());
        storeAccessService.checkStore(storeId);
        return ResponseEntity.ok(menuService.create(
                storeId,
                body.get("menuName").toString(),
                Integer.parseInt(body.get("price").toString()),
                category
        ));
    }

    @GetMapping("/{storeId}")
    public ResponseEntity<List<Menu>> getActiveMenus(@PathVariable Long storeId) {
        storeAccessService.checkStore(storeId);
        return ResponseEntity.ok(menuService.getActiveMenus(storeId));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Menu> update(@PathVariable Long id,
                                       @RequestBody Map<String, Object> body) {
        storeAccessService.checkStore(menuService.getById(id).getStore().getId());
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
        storeAccessService.checkStore(menuService.getById(id).getStore().getId());
        return ResponseEntity.ok(menuService.deactivate(id));
    }
}
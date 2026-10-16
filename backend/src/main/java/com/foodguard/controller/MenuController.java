package com.foodguard.controller;

import com.foodguard.entity.Menu;
import com.foodguard.service.MenuService;
import com.foodguard.security.StoreAccessGuard;
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
    private final StoreAccessGuard guard;

    @PostMapping
    public ResponseEntity<Menu> create(@RequestBody Map<String, Object> body) {
        Long storeId = Long.parseLong(body.get("storeId").toString());
        guard.assertCanAccessStore(storeId);
        return ResponseEntity.ok(menuService.create(
                storeId,
                body.get("menuName").toString(),
                Integer.parseInt(body.get("price").toString()),
                str(body.get("category")),
                str(body.get("imageUrl"))
        ));
    }

    @GetMapping("/{storeId}")
    public ResponseEntity<List<Menu>> getActiveMenus(@PathVariable Long storeId) {
        guard.assertCanAccessStore(storeId);
        return ResponseEntity.ok(menuService.getActiveMenus(storeId));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Menu> update(@PathVariable Long id,
                                       @RequestBody Map<String, Object> body) {
        guard.assertCanAccessMenu(id);
        return ResponseEntity.ok(menuService.update(
                id,
                body.get("menuName").toString(),
                Integer.parseInt(body.get("price").toString()),
                str(body.get("category")),
                str(body.get("imageUrl"))
        ));
    }

    private static String str(Object v) {
        return v == null ? null : v.toString();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<String> deactivate(@PathVariable Long id) {
        guard.assertCanAccessMenu(id);
        return ResponseEntity.ok(menuService.deactivate(id));
    }
}
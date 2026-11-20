package com.foodguard.controller;

import com.foodguard.entity.MenuIngredient;
import com.foodguard.service.MenuIngredientService;
import com.foodguard.security.StoreAccessGuard;
import com.foodguard.service.RecipeDraftService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/menu-ingredients")
@RequiredArgsConstructor
public class MenuIngredientController {

    private final MenuIngredientService menuIngredientService;
    private final StoreAccessGuard guard;

    private final RecipeDraftService recipeDraftService;
    @PostMapping
    public ResponseEntity<MenuIngredient> add(@RequestBody Map<String, Object> body) {
        Object tol = body.get("tolerance");
        Long menuId = Long.valueOf(body.get("menuId").toString());
        guard.assertCanAccessMenu(menuId);
        return ResponseEntity.ok(menuIngredientService.add(
                menuId,
                Long.valueOf(body.get("ingredientId").toString()),
                Double.valueOf(body.get("qtyPerUnit").toString()),
                body.get("unit").toString(),
                tol == null ? 0.0 : Double.valueOf(tol.toString())
        ));
    }

    // 매장 전체 레시피 (메뉴 화면, 재고 화면)
    @GetMapping("/store/{storeId}")
    public ResponseEntity<List<Map<String, Object>>> getByStore(@PathVariable Long storeId) {
        return ResponseEntity.ok(menuIngredientService.getByStore(storeId));
    }

    @GetMapping("/menu/{menuId}")
    public ResponseEntity<List<MenuIngredient>> getByMenu(@PathVariable Long menuId) {
        return ResponseEntity.ok(menuIngredientService.getByMenu(menuId));
    }

    // AI 레시피 초안 (저장하지 않음)
    @PostMapping("/menu/{menuId}/draft")
    public ResponseEntity<Map<String, Object>> draft(@PathVariable Long menuId) {
        return ResponseEntity.ok(recipeDraftService.draft(menuId));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        guard.assertCanAccessMenuIngredient(id);
        menuIngredientService.delete(id);
        return ResponseEntity.noContent().build();
    }}

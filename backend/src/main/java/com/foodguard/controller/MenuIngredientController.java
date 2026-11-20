package com.foodguard.controller;

import com.foodguard.entity.MenuIngredient;
import com.foodguard.service.MenuIngredientService;
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
    @PostMapping
    public ResponseEntity<MenuIngredient> add(@RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(menuIngredientService.add(
                Long.valueOf(body.get("menuId").toString()),
                Long.valueOf(body.get("ingredientId").toString()),
                Double.valueOf(body.get("qtyPerUnit").toString()),
                body.get("unit").toString()
        ));
    }

    // 매장 전체 레시피 (메뉴 화면, 재고 화면)
    @GetMapping("/store/{storeId}")
    public ResponseEntity<List<Map<String, Object>>> getByStore(@PathVariable Long storeId) {
        return ResponseEntity.ok(menuIngredientService.getByStore(storeId));
    }

    @GetMapping("/menu/{menuId}")    public ResponseEntity<List<MenuIngredient>> getByMenu(@PathVariable Long menuId) {
        return ResponseEntity.ok(menuIngredientService.getByMenu(menuId));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        menuIngredientService.delete(id);
        return ResponseEntity.noContent().build();
    }}

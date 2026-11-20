package com.foodguard.controller;

import com.foodguard.entity.MenuIngredient;
import com.foodguard.service.MenuIngredientService;
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
    private final RecipeDraftService recipeDraftService;
    @PostMapping
    public ResponseEntity<MenuIngredient> add(@RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(menuIngredientService.add(
                Long.valueOf(body.get("menuId").toString()),
                Long.valueOf(body.get("ingredientId").toString()),
                Double.valueOf(body.get("qtyPerUnit").toString()),
                body.get("unit").toString()
        ));
    }

    @GetMapping("/menu/{menuId}")    public ResponseEntity<List<MenuIngredient>> getByMenu(@PathVariable Long menuId) {
        return ResponseEntity.ok(menuIngredientService.getByMenu(menuId));
    }

    // AI 레시피 초안 (저장하지 않음)
    @PostMapping("/menu/{menuId}/draft")
    public ResponseEntity<Map<String, Object>> draft(@PathVariable Long menuId) {
        return ResponseEntity.ok(recipeDraftService.draft(menuId));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        menuIngredientService.delete(id);
        return ResponseEntity.noContent().build();
    }}

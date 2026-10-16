package com.foodguard.controller;

import com.foodguard.entity.MenuIngredient;
import com.foodguard.service.MenuIngredientService;
import com.foodguard.service.MenuService;
import com.foodguard.service.StoreAccessService;
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
    private final MenuService menuService;
    private final StoreAccessService storeAccessService;
    @PostMapping
    public ResponseEntity<MenuIngredient> add(@RequestBody Map<String, Object> body) {
        Long menuId = Long.valueOf(body.get("menuId").toString());
        storeAccessService.checkStore(menuService.getById(menuId).getStore().getId());
        return ResponseEntity.ok(menuIngredientService.add(
                menuId,
                Long.valueOf(body.get("ingredientId").toString()),
                Double.valueOf(body.get("qtyPerUnit").toString()),
                body.get("unit").toString()
        ));
    }

    @GetMapping("/menu/{menuId}")    public ResponseEntity<List<MenuIngredient>> getByMenu(@PathVariable Long menuId) {
        storeAccessService.checkStore(menuService.getById(menuId).getStore().getId());
        return ResponseEntity.ok(menuIngredientService.getByMenu(menuId));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        storeAccessService.checkStore(menuIngredientService.getById(id).getMenu().getStore().getId());
        menuIngredientService.delete(id);
        return ResponseEntity.noContent().build();
    }}

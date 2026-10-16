package com.foodguard.controller;

import com.foodguard.entity.Ingredient;
import com.foodguard.entity.Store;
import com.foodguard.service.IngredientService;
import com.foodguard.service.StoreAccessService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ingredients")
@RequiredArgsConstructor
public class IngredientController {

    private final IngredientService ingredientService;
    private final StoreAccessService storeAccessService;

    @PostMapping
    public ResponseEntity<Ingredient> create(@RequestBody Map<String, Object> body) {
        Long storeId = Long.parseLong(body.get("storeId").toString());
        storeAccessService.checkStore(storeId);
        return ResponseEntity.ok(ingredientService.create(
                storeId,
                body.get("name").toString(),
                body.getOrDefault("category", "").toString(),
                body.get("unit").toString()
        ));
    }

    @GetMapping
    public ResponseEntity<List<Ingredient>> getByStore(@RequestParam Long storeId) {
        storeAccessService.checkStore(storeId);
        return ResponseEntity.ok(ingredientService.getByStore(storeId));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Ingredient> update(@PathVariable Long id,
                                             @RequestBody Map<String, Object> body) {
        checkIngredientStore(id);
        return ResponseEntity.ok(ingredientService.update(
                id,
                body.get("name").toString(),
                body.getOrDefault("category", "").toString(),
                body.get("unit").toString()
        ));
    }
    @DeleteMapping("/{id}")
    public ResponseEntity<String> delete(@PathVariable Long id) {
        checkIngredientStore(id);
        return ResponseEntity.ok(ingredientService.delete(id));
    }

    // store_id 없는 기존 공용 식자재는 매장 확인 대상에서 제외 (기존 동작 유지)
    private void checkIngredientStore(Long id) {
        Store store = ingredientService.getById(id).getStore();
        if (store != null) storeAccessService.checkStore(store.getId());
    }
}
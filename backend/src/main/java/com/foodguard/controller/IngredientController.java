package com.foodguard.controller;

import com.foodguard.entity.Ingredient;
import com.foodguard.service.IngredientService;
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

    @PostMapping
    public ResponseEntity<Ingredient> create(@RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(ingredientService.create(
                Long.parseLong(body.get("storeId").toString()),
                body.get("name").toString(),
                body.getOrDefault("category", "").toString(),
                body.get("unit").toString()
        ));
    }

    @GetMapping
    public ResponseEntity<List<Ingredient>> getByStore(@RequestParam Long storeId) {
        return ResponseEntity.ok(ingredientService.getByStore(storeId));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Ingredient> update(@PathVariable Long id,
                                             @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(ingredientService.update(
                id,
                body.get("name").toString(),
                body.getOrDefault("category", "").toString(),
                body.get("unit").toString(),
                optionalDays(body, "shelfLifeDays", 1),
                optionalDays(body, "leadTimeDays", 0),
                optionalDays(body, "orderCycleDays", 1)
        ));
    }

    // 비어 있으면 null (발주 계산에서 기본값 사용)
    private static Integer optionalDays(Map<String, Object> body, String key, int min) {
        Object value = body.get(key);
        if (value == null || value.toString().isBlank()) return null;
        int days = Integer.parseInt(value.toString());
        if (days < min) throw new RuntimeException(key + " 는 " + min + " 이상이어야 합니다.");
        return days;
    }
    @DeleteMapping("/{id}")
    public ResponseEntity<String> delete(@PathVariable Long id) {
        return ResponseEntity.ok(ingredientService.delete(id));
    }
}
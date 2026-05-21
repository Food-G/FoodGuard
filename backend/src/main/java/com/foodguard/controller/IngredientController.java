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
                body.get("name").toString(),
                body.getOrDefault("category", "").toString(),
                body.get("unit").toString()
        ));
    }

    @GetMapping
    public ResponseEntity<List<Ingredient>> getAll() {
        return ResponseEntity.ok(ingredientService.getAll());
    }

    @PutMapping("/{id}")
    public ResponseEntity<Ingredient> update(@PathVariable Long id,
                                             @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(ingredientService.update(
                id,
                body.get("name").toString(),
                body.getOrDefault("category", "").toString(),
                body.get("unit").toString()
        ));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<String> delete(@PathVariable Long id) {
        return ResponseEntity.ok(ingredientService.delete(id));
    }
}
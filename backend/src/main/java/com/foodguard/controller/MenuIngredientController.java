package com.foodguard.controller;

import com.foodguard.entity.MenuIngredient;
import com.foodguard.service.MenuIngredientService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
    // 레시피 등록 (메뉴-재료 연결)
    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        try {
            return ResponseEntity.ok(menuIngredientService.create(
                    Long.parseLong(body.get("menuId").toString()),
                    Long.parseLong(body.get("ingredientId").toString()),
                    Double.parseDouble(body.get("qtyPerUnit").toString()),
                    body.containsKey("unit") ? body.get("unit").toString() : null
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // 단건 조회
    @GetMapping("/detail/{id}")
    public ResponseEntity<?> getById(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(menuIngredientService.getById(id));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // 메뉴 기준 레시피 조회    @GetMapping("/menu/{menuId}")
    public ResponseEntity<List<MenuIngredient>> getByMenu(@PathVariable Long menuId) {
        return ResponseEntity.ok(menuIngredientService.getByMenu(menuId));
    }

    // 식자재 기준 사용 메뉴 조회
    @GetMapping("/ingredient/{ingredientId}")
    public ResponseEntity<List<MenuIngredient>> getByIngredient(@PathVariable Long ingredientId) {
        return ResponseEntity.ok(menuIngredientService.getByIngredient(ingredientId));
    }

    // 레시피 수정
    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id,
                                    @RequestBody Map<String, Object> body) {
        try {
            return ResponseEntity.ok(menuIngredientService.update(
                    id,
                    body.containsKey("qtyPerUnit") ? Double.parseDouble(body.get("qtyPerUnit").toString()) : null,
                    body.containsKey("unit") ? body.get("unit").toString() : null
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // 레시피 삭제
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(Map.of("message", menuIngredientService.delete(id)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }    }
}

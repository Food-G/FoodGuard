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
        String name = body.get("name").toString();
        String category = String.valueOf(body.getOrDefault("category", ""));
        String unit = body.get("unit").toString();
        // storeId 를 안 보내는 화면(메뉴 관리·식자재 목록)은 로그인한 점주의 매장으로 등록한다
        Ingredient created = body.get("storeId") == null
                ? ingredientService.create(name, category, unit)
                : ingredientService.create(Long.parseLong(body.get("storeId").toString()), name, category, unit);
        if (body.containsKey("imageUrl")) created = ingredientService.updateImage(created.getId(), (String) body.get("imageUrl"));
        return ResponseEntity.ok(created);
    }

    @GetMapping
    public ResponseEntity<List<Ingredient>> getByStore(@RequestParam(required = false) Long storeId) {
        // storeId 없이 부르면 로그인한 사용자가 볼 수 있는 식자재 (점주: 자기 매장 + 공용, 본사: 전체)
        if (storeId == null) return ResponseEntity.ok(ingredientService.getVisible());
        return ResponseEntity.ok(ingredientService.getByStore(storeId));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Ingredient> update(@PathVariable Long id,
                                             @RequestBody Map<String, Object> body) {
        // 보내지 않은 항목(이름·단위만 고치는 화면)은 기존 값을 유지한다
        Ingredient current = ingredientService.getById(id);
        if (body.containsKey("imageUrl")) ingredientService.updateImage(id, (String) body.get("imageUrl"));
        return ResponseEntity.ok(ingredientService.update(
                id,
                body.get("name").toString(),
                body.containsKey("category") ? String.valueOf(body.get("category")) : current.getCategory(),
                body.get("unit").toString(),
                body.containsKey("shelfLifeDays") ? optionalDays(body, "shelfLifeDays", 1) : current.getShelfLifeDays(),
                body.containsKey("leadTimeDays") ? optionalDays(body, "leadTimeDays", 0) : current.getLeadTimeDays(),
                body.containsKey("orderCycleDays") ? optionalDays(body, "orderCycleDays", 1) : current.getOrderCycleDays()
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
package com.foodguard.controller;

import com.foodguard.service.DiscountService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

// {storeId}·본문 storeId·menuId 소유 검사는 StoreAccessInterceptor·StoreAccessBodyAdvice, {id} 는 ID_ENTITY 가 한다
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class DiscountController {

    private final DiscountService discountService;

    @GetMapping("/discounts/store/{storeId}/candidates")
    public ResponseEntity<List<Map<String, Object>>> candidates(@PathVariable Long storeId) {
        return ResponseEntity.ok(discountService.candidates(storeId));
    }

    @PostMapping("/discounts/store/{storeId}/briefing")
    public ResponseEntity<Map<String, Object>> briefing(@PathVariable Long storeId) {
        return ResponseEntity.ok(discountService.briefing(storeId));
    }

    @GetMapping("/discounts/store/{storeId}")
    public ResponseEntity<List<Map<String, Object>>> active(@PathVariable Long storeId) {
        return ResponseEntity.ok(discountService.active(storeId));
    }

    @PostMapping("/discounts")
    public ResponseEntity<Map<String, Object>> apply(@RequestBody Map<String, Object> body) {
        Object ingredientId = body.get("ingredientId");
        return ResponseEntity.ok(discountService.apply(
                Long.valueOf(body.get("storeId").toString()),
                Long.valueOf(body.get("menuId").toString()),
                ingredientId == null ? null : Long.valueOf(ingredientId.toString()),
                Integer.parseInt(body.get("discountPct").toString()),
                LocalDate.parse(body.get("endDate").toString())));
    }

    @DeleteMapping("/discounts/{id}")
    public ResponseEntity<Void> end(@PathVariable Long id) {
        discountService.end(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/pos/{storeId}/checkout")
    public ResponseEntity<Map<String, Object>> checkout(@PathVariable Long storeId, @RequestBody List<Map<String, Object>> items) {
        return ResponseEntity.ok(discountService.checkout(storeId, items));
    }
}

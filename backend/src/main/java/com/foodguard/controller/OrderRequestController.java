package com.foodguard.controller;

import com.foodguard.entity.Inventory;
import com.foodguard.entity.OrderRequest;
import com.foodguard.service.OrderRequestService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderRequestController {

    private final OrderRequestService orderRequestService;

    // 발주 요청 생성
    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        try {
            return ResponseEntity.ok(orderRequestService.create(
                    Long.parseLong(body.get("storeId").toString()),
                    Long.parseLong(body.get("ingredientId").toString()),
                    Double.parseDouble(body.get("quantity").toString())
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // 단건 조회
    @GetMapping("/detail/{id}")
    public ResponseEntity<?> getById(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(orderRequestService.getById(id));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // 가맹점 발주 전체 조회
    @GetMapping("/{storeId}")
    public ResponseEntity<List<OrderRequest>> getByStore(@PathVariable Long storeId) {
        return ResponseEntity.ok(orderRequestService.getByStore(storeId));
    }

    // 상태별 발주 조회
    @GetMapping("/{storeId}/status/{status}")
    public ResponseEntity<List<OrderRequest>> getByStatus(@PathVariable Long storeId,
                                                          @PathVariable String status) {
        return ResponseEntity.ok(orderRequestService.getByStatus(storeId, status));
    }

    // 전체 발주 조회 (본사용)
    @GetMapping
    public ResponseEntity<List<OrderRequest>> getAllOrders() {
        return ResponseEntity.ok(orderRequestService.getAllOrders());
    }

    // 발주 상태 변경
    @PutMapping("/{id}/status")
    public ResponseEntity<?> updateStatus(@PathVariable Long id,
                                          @RequestBody Map<String, Object> body) {
        try {
            return ResponseEntity.ok(orderRequestService.updateStatus(
                    id, body.get("status").toString()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // 발주 취소
    @DeleteMapping("/{id}")
    public ResponseEntity<?> cancel(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(Map.of("message", orderRequestService.cancel(id)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
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

<<<<<<< HEAD
    @PostMapping("/init-inventory/{storeId}")
    public ResponseEntity<List<Inventory>> initInventory(@PathVariable Long storeId) {
        return ResponseEntity.ok(orderRequestService.initInventoryFromOrders(storeId));
    }

    @GetMapping("/admin/all")
    public ResponseEntity<List<OrderRequest>> getAll() {
        return ResponseEntity.ok(orderRequestService.getAll());
    }

    @GetMapping("/recommend/{storeId}")
    public ResponseEntity<List<Map<String, Object>>> recommend(@PathVariable Long storeId) {
        return ResponseEntity.ok(orderRequestService.recommend(storeId));
    }

    @PostMapping("/auto/{storeId}")
    public ResponseEntity<List<OrderRequest>> autoOrder(@PathVariable Long storeId) {
        return ResponseEntity.ok(orderRequestService.autoOrder(storeId));
    }

    // 가맹점 전체 발주 일괄 승인 — 그룹 토큰 반환
    @PostMapping("/approve-all/{storeId}")
    public ResponseEntity<Map<String, Object>> approveAll(@PathVariable Long storeId) {
        String groupToken = orderRequestService.approveAllForStore(storeId);
        if (groupToken == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "승인할 발주가 없습니다."));
        }
        return ResponseEntity.ok(Map.of("groupToken", groupToken));
    }
}
=======
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
>>>>>>> 233f87c (feat: CRUD 완성 및 FoodGuard UI 전면 개선)

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

    @PostMapping
    public ResponseEntity<OrderRequest> create(@RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(orderRequestService.create(
                Long.parseLong(body.get("storeId").toString()),
                Long.parseLong(body.get("ingredientId").toString()),
                Double.parseDouble(body.get("quantity").toString())
        ));
    }

    @GetMapping("/admin/all")
    public ResponseEntity<List<OrderRequest>> getAll() {
        return ResponseEntity.ok(orderRequestService.getAll());
    }

    @GetMapping("/{storeId}")
    public ResponseEntity<List<OrderRequest>> getByStore(@PathVariable Long storeId) {
        return ResponseEntity.ok(orderRequestService.getByStore(storeId));
    }

    // 1단계: 본사 발송 검수 완료
    @PostMapping("/{id}/hq-send")
    public ResponseEntity<OrderRequest> hqSend(@PathVariable Long id) {
        return ResponseEntity.ok(orderRequestService.hqSend(id));
    }

    // 2단계: 배달기사 수령 확인
    @PostMapping("/{id}/driver-receive")
    public ResponseEntity<OrderRequest> driverReceive(@PathVariable Long id) {
        return ResponseEntity.ok(orderRequestService.driverReceive(id));
    }

    // 3단계: 가맹점주 수령 확인
    @PostMapping("/{id}/owner-receive")
    public ResponseEntity<OrderRequest> ownerReceive(@PathVariable Long id) {
        return ResponseEntity.ok(orderRequestService.ownerReceive(id));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<OrderRequest> updateStatus(@PathVariable Long id,
                                                     @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(orderRequestService.updateStatus(
                id, body.get("status").toString()
        ));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<String> cancel(@PathVariable Long id) {
        return ResponseEntity.ok(orderRequestService.cancel(id));
    }

    @GetMapping("/recommend/{storeId}")
    public ResponseEntity<List<Map<String, Object>>> recommend(@PathVariable Long storeId) {
        return ResponseEntity.ok(orderRequestService.recommend(storeId));
    }

    @PostMapping("/auto/{storeId}")
    public ResponseEntity<?> autoOrder(@PathVariable Long storeId) {
        try {
            return ResponseEntity.ok(orderRequestService.autoOrder(storeId));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
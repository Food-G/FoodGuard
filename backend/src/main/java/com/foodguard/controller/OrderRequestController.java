package com.foodguard.controller;

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

    @GetMapping("/{storeId}")
    public ResponseEntity<List<OrderRequest>> getByStore(@PathVariable Long storeId) {
        return ResponseEntity.ok(orderRequestService.getByStore(storeId));
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
    public ResponseEntity<List<OrderRequest>> autoOrder(@PathVariable Long storeId) {
        return ResponseEntity.ok(orderRequestService.autoOrder(storeId));
    }
}
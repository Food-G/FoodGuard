package com.foodguard.controller;

import com.foodguard.entity.OrderItem;
import com.foodguard.service.OrderItemService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/order-items")
@RequiredArgsConstructor
public class OrderItemController {

    private final OrderItemService orderItemService;

    @PostMapping
    public OrderItem create(
            @RequestParam Long orderId,
            @RequestParam String ingredientName,
            @RequestParam BigDecimal quantity,
            @RequestParam String unit,
            @RequestParam(required = false) BigDecimal unitPrice) {
        return orderItemService.create(orderId, ingredientName, quantity, unit, unitPrice);
    }

    @GetMapping("/order/{orderId}")
    public List<OrderItem> getByOrder(@PathVariable Long orderId) {
        return orderItemService.getByOrder(orderId);
    }

    @DeleteMapping("/{id}")
    public String delete(@PathVariable Long id) {
        return orderItemService.delete(id);
    }
}

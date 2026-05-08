package com.foodguard.service;

import com.foodguard.entity.OrderItem;
import com.foodguard.entity.OrderRequest;
import com.foodguard.repository.OrderItemRepository;
import com.foodguard.repository.OrderRequestRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
public class OrderItemService {

    private final OrderItemRepository orderItemRepository;
    private final OrderRequestRepository orderRequestRepository;

    public OrderItem create(Long orderId, String ingredientName, BigDecimal quantity,
                            String unit, BigDecimal unitPrice) {
        OrderRequest order = orderRequestRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("발주 요청을 찾을 수 없습니다."));

        OrderItem item = new OrderItem();
        item.setOrder(order);
        item.setIngredientName(ingredientName);
        item.setQuantity(quantity);
        item.setUnit(unit);
        item.setUnitPrice(unitPrice);
        if (unitPrice != null) {
            item.setSubtotal(unitPrice.multiply(quantity));
        }
        return orderItemRepository.save(item);
    }

    public List<OrderItem> getByOrder(Long orderId) {
        return orderItemRepository.findByOrderId(orderId);
    }

    public String delete(Long id) {
        orderItemRepository.deleteById(id);
        return "발주 항목 삭제 완료";
    }
}

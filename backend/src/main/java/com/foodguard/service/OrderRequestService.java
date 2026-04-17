package com.foodguard.service;

import com.foodguard.entity.Ingredient;
import com.foodguard.entity.OrderRequest;
import com.foodguard.entity.Store;
import com.foodguard.repository.IngredientRepository;
import com.foodguard.repository.OrderRequestRepository;
import com.foodguard.repository.StoreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class OrderRequestService {

    private final OrderRequestRepository orderRequestRepository;
    private final StoreRepository storeRepository;
    private final IngredientRepository ingredientRepository;

    // 발주 요청
    public OrderRequest create(Long storeId, Long ingredientId, Double quantity) {
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new RuntimeException("가맹점을 찾을 수 없습니다."));
        Ingredient ingredient = ingredientRepository.findById(ingredientId)
                .orElseThrow(() -> new RuntimeException("식자재를 찾을 수 없습니다."));

        OrderRequest order = new OrderRequest();
        order.setStore(store);
        order.setIngredient(ingredient);
        order.setQuantity(quantity);
        return orderRequestRepository.save(order);
    }

    // 가맹점 발주 내역 조회
    public List<OrderRequest> getByStore(Long storeId) {
        return orderRequestRepository.findByStoreId(storeId);
    }

    // 발주 상태 변경 (본사가 승인/완료 처리)
    public OrderRequest updateStatus(Long id, String status) {
        OrderRequest order = orderRequestRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("발주 요청을 찾을 수 없습니다."));
        order.setStatus(status);
        return orderRequestRepository.save(order);
    }

    // 발주 취소 (PENDING 상태만 가능)
    public String cancel(Long id) {
        OrderRequest order = orderRequestRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("발주 요청을 찾을 수 없습니다."));
        if (!order.getStatus().equals("PENDING")) {
            return "승인된 발주는 취소할 수 없습니다.";
        }
        orderRequestRepository.deleteById(id);
        return "발주 취소 완료";
    }
}
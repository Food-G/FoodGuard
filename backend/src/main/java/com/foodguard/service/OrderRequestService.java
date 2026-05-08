package com.foodguard.service;

import com.foodguard.entity.OrderRequest;
import com.foodguard.entity.Store;
import com.foodguard.entity.User;
import com.foodguard.repository.OrderRequestRepository;
import com.foodguard.repository.StoreRepository;
import com.foodguard.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
public class OrderRequestService {

    private final OrderRequestRepository orderRequestRepository;
    private final StoreRepository storeRepository;
    private final UserRepository userRepository;

    public OrderRequest create(Long storeId, Long userId, BigDecimal totalAmount, String note) {
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new RuntimeException("가맹점을 찾을 수 없습니다."));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("유저를 찾을 수 없습니다."));

        OrderRequest order = new OrderRequest();
        order.setStore(store);
        order.setUser(user);
        order.setTotalAmount(totalAmount);
        order.setNote(note);
        return orderRequestRepository.save(order);
    }

    public List<OrderRequest> getByStore(Long storeId) {
        return orderRequestRepository.findByStoreId(storeId);
    }

    public OrderRequest updateStatus(Long id, String status) {
        OrderRequest order = orderRequestRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("발주 요청을 찾을 수 없습니다."));
        order.setStatus(status);
        return orderRequestRepository.save(order);
    }

    public String cancel(Long id) {
        OrderRequest order = orderRequestRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("발주 요청을 찾을 수 없습니다."));
        if (!order.getStatus().equals("REQUESTED")) {
            return "처리 중인 발주는 취소할 수 없습니다.";
        }
        order.setStatus("CANCELLED");
        orderRequestRepository.save(order);
        return "발주 취소 완료";
    }
}

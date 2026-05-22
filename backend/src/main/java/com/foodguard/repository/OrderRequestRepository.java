package com.foodguard.repository;

import com.foodguard.entity.OrderRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface OrderRequestRepository extends JpaRepository<OrderRequest, Long> {
    List<OrderRequest> findByStoreId(Long storeId);
    List<OrderRequest> findByStoreIdAndStatus(Long storeId, String status);
    List<OrderRequest> findByStoreIdAndStatusIn(Long storeId, List<String> statuses);
    void deleteByIngredientId(Long ingredientId);
    void deleteByStoreIdAndIngredientIdAndStatus(Long storeId, Long ingredientId, String status);
    Optional<OrderRequest> findByDeliveryToken(String deliveryToken);
    List<OrderRequest> findByDeliveryGroupToken(String deliveryGroupToken);
}
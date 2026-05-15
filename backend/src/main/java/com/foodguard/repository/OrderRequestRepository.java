package com.foodguard.repository;

import com.foodguard.entity.OrderRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface OrderRequestRepository extends JpaRepository<OrderRequest, Long> {
    List<OrderRequest> findByStoreId(Long storeId);
    List<OrderRequest> findByStoreIdAndStatus(Long storeId, String status);
    void deleteByIngredientId(Long ingredientId);
    void deleteByStoreIdAndIngredientIdAndStatus(Long storeId, Long ingredientId, String status);
}
package com.foodguard.repository;

import com.foodguard.entity.Inventory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface InventoryRepository extends JpaRepository<Inventory, Long> {
    List<Inventory> findByStoreId(Long storeId);
<<<<<<< HEAD
    void deleteByIngredientId(Long ingredientId);
    void deleteByStoreId(Long storeId);
    Optional<Inventory> findByStoreIdAndIngredientId(Long storeId, Long ingredientId);
}
=======

    // 최소 임계값 이하 재고 조회
    @Query("SELECT i FROM Inventory i WHERE i.store.id = :storeId AND i.currentQty < i.minThreshold")
    List<Inventory> findLowStockByStoreId(@Param("storeId") Long storeId);

    // 매장+재료로 재고 단건 조회 (자동 차감용)
    Optional<Inventory> findByStoreIdAndIngredientId(Long storeId, Long ingredientId);
}
>>>>>>> 233f87c (feat: CRUD 완성 및 FoodGuard UI 전면 개선)

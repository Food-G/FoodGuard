package com.foodguard.repository;

import com.foodguard.entity.Inventory;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface InventoryRepository extends JpaRepository<Inventory, Long> {
    List<Inventory> findByStoreId(Long storeId);
    boolean existsByIngredientId(Long ingredientId);
    List<Inventory> findByIngredientId(Long ingredientId);
    void deleteByIngredientId(Long ingredientId);
    void deleteByStoreId(Long storeId);
    Optional<Inventory> findByStoreIdAndIngredientId(Long storeId, Long ingredientId);
}
package com.foodguard.repository;

import com.foodguard.entity.Inventory;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface InventoryRepository extends JpaRepository<Inventory, Long> {
    List<Inventory> findByStoreId(Long storeId);
    void deleteByIngredientId(Long ingredientId);
}
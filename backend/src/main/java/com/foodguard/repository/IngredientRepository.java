package com.foodguard.repository;

import com.foodguard.entity.Ingredient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface IngredientRepository extends JpaRepository<Ingredient, Long> {
    @Query("SELECT i FROM Ingredient i WHERE i.store.id = :storeId OR i.store IS NULL")
    List<Ingredient> findByStoreIdIncludingLegacy(@Param("storeId") Long storeId);
}
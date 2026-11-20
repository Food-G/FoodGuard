package com.foodguard.repository;

import com.foodguard.entity.MenuIngredient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface MenuIngredientRepository extends JpaRepository<MenuIngredient, Long> {
    List<MenuIngredient> findByMenuId(Long menuId);

    // 매장 활성 메뉴의 레시피 전체
    @Query("SELECT mi FROM MenuIngredient mi JOIN FETCH mi.menu m WHERE m.store.id = :storeId AND m.isActive = true")
    List<MenuIngredient> findActiveByStore(@Param("storeId") Long storeId);

    List<MenuIngredient> findByIngredientId(Long ingredientId);
    void deleteByIngredientId(Long ingredientId);
}
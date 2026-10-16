package com.foodguard.repository;

import com.foodguard.entity.MenuIngredient;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface MenuIngredientRepository extends JpaRepository<MenuIngredient, Long> {
    List<MenuIngredient> findByMenuId(Long menuId);
    void deleteByIngredientId(Long ingredientId);
}
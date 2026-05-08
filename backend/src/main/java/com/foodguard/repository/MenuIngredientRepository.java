package com.foodguard.repository;

import com.foodguard.entity.MenuIngredient;
import org.springframework.data.jpa.repository.JpaRepository;
<<<<<<< HEAD
=======

>>>>>>> 233f87c (feat: CRUD 완성 및 FoodGuard UI 전면 개선)
import java.util.List;

public interface MenuIngredientRepository extends JpaRepository<MenuIngredient, Long> {
    List<MenuIngredient> findByMenuId(Long menuId);
<<<<<<< HEAD
    void deleteByIngredientId(Long ingredientId);
=======
    List<MenuIngredient> findByIngredientId(Long ingredientId);
>>>>>>> 233f87c (feat: CRUD 완성 및 FoodGuard UI 전면 개선)
}

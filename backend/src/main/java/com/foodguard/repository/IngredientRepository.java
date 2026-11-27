package com.foodguard.repository;

import com.foodguard.entity.Ingredient;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface IngredientRepository extends JpaRepository<Ingredient, Long> {
    // 같은 이름·단위가 여러 개면(과거 중복) 가장 먼저 만든 것을 쓴다
    Optional<Ingredient> findFirstByNameAndUnitOrderByIdAsc(String name, String unit);
}
package com.foodguard.service;

import com.foodguard.entity.Ingredient;
import com.foodguard.repository.IngredientRepository;
import com.foodguard.repository.InventoryRepository;
import com.foodguard.repository.MenuIngredientRepository;
import com.foodguard.repository.OrderRequestRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class IngredientService {

    private final IngredientRepository ingredientRepository;
    private final MenuIngredientRepository menuIngredientRepository;
    private final InventoryRepository inventoryRepository;
    private final OrderRequestRepository orderRequestRepository;

    // 식자재 등록
    @Transactional
    public Ingredient create(String name, String category, String unit) {
        Ingredient ingredient = new Ingredient();
        ingredient.setName(name);
        ingredient.setCategory(category);
        ingredient.setUnit(unit);
        return ingredientRepository.save(ingredient);
    }

    // 단건 조회
    public Ingredient getById(Long id) {
        return ingredientRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("식자재를 찾을 수 없습니다."));
    }

    // 전체 식자재 조회
    public List<Ingredient> getAll() {
        return ingredientRepository.findAll();
    }

    // 식자재 수정
    @Transactional
    public Ingredient update(Long id, String name, String category, String unit) {
        Ingredient ingredient = getById(id);
        if (name != null) ingredient.setName(name);
        if (category != null) ingredient.setCategory(category);
        if (unit != null) ingredient.setUnit(unit);
        return ingredientRepository.save(ingredient);
    }

    // 식자재 삭제
    @Transactional
    public String delete(Long id) {
        if (!ingredientRepository.existsById(id)) {
            throw new RuntimeException("식자재를 찾을 수 없습니다.");
        }        ingredientRepository.deleteById(id);
        return "식자재 삭제 완료";
    }
}

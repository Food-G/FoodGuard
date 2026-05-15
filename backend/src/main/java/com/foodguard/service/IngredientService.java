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
    public Ingredient create(String name, String category, String unit) {
        Ingredient ingredient = new Ingredient();
        ingredient.setName(name);
        ingredient.setCategory(category);
        ingredient.setUnit(unit);
        return ingredientRepository.save(ingredient);
    }

    // 전체 식자재 조회
    public List<Ingredient> getAll() {
        return ingredientRepository.findAll();
    }

    // 식자재 수정
    public Ingredient update(Long id, String name, String category, String unit) {
        Ingredient ingredient = ingredientRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("식자재를 찾을 수 없습니다."));
        ingredient.setName(name);
        ingredient.setCategory(category);
        ingredient.setUnit(unit);
        return ingredientRepository.save(ingredient);
    }

    // 식자재 삭제 (연결 레코드 전부 먼저 삭제: 발주→메뉴구성→재고→식자재)
    @Transactional
    public String delete(Long id) {
        orderRequestRepository.deleteByIngredientId(id);
        menuIngredientRepository.deleteByIngredientId(id);
        inventoryRepository.deleteByIngredientId(id);
        ingredientRepository.deleteById(id);        return "식자재 삭제 완료";
    }
}
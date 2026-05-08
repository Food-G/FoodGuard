package com.foodguard.service;

import com.foodguard.entity.Ingredient;
import com.foodguard.entity.Menu;
import com.foodguard.entity.MenuIngredient;
import com.foodguard.repository.IngredientRepository;
import com.foodguard.repository.MenuIngredientRepository;
import com.foodguard.repository.MenuRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
<<<<<<< HEAD
=======
import org.springframework.transaction.annotation.Transactional;

>>>>>>> 233f87c (feat: CRUD 완성 및 FoodGuard UI 전면 개선)
import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
public class MenuIngredientService {

    private final MenuIngredientRepository menuIngredientRepository;
    private final MenuRepository menuRepository;
    private final IngredientRepository ingredientRepository;

<<<<<<< HEAD
    public MenuIngredient add(Long menuId, Long ingredientId, Double qtyPerUnit, String unit) {
=======
    // 메뉴-재료 연결 등록 (레시피)
    @Transactional
    public MenuIngredient create(Long menuId, Long ingredientId, Double qtyPerUnit, String unit) {
>>>>>>> 233f87c (feat: CRUD 완성 및 FoodGuard UI 전면 개선)
        Menu menu = menuRepository.findById(menuId)
                .orElseThrow(() -> new RuntimeException("메뉴를 찾을 수 없습니다."));
        Ingredient ingredient = ingredientRepository.findById(ingredientId)
                .orElseThrow(() -> new RuntimeException("식자재를 찾을 수 없습니다."));

        MenuIngredient mi = new MenuIngredient();
        mi.setMenu(menu);
        mi.setIngredient(ingredient);
        mi.setQtyPerUnit(BigDecimal.valueOf(qtyPerUnit));
<<<<<<< HEAD
        mi.setUnit(unit);
        return menuIngredientRepository.save(mi);
    }

=======
        mi.setUnit(unit != null ? unit : ingredient.getUnit());
        return menuIngredientRepository.save(mi);
    }

    // 메뉴 기준 레시피 조회
>>>>>>> 233f87c (feat: CRUD 완성 및 FoodGuard UI 전면 개선)
    public List<MenuIngredient> getByMenu(Long menuId) {
        return menuIngredientRepository.findByMenuId(menuId);
    }

<<<<<<< HEAD
    public void delete(Long id) {
        menuIngredientRepository.deleteById(id);
=======
    // 식자재 기준 사용 메뉴 조회
    public List<MenuIngredient> getByIngredient(Long ingredientId) {
        return menuIngredientRepository.findByIngredientId(ingredientId);
    }

    // 단건 조회
    public MenuIngredient getById(Long id) {
        return menuIngredientRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("레시피 항목을 찾을 수 없습니다."));
    }

    // 수정 (단위 사용량)
    @Transactional
    public MenuIngredient update(Long id, Double qtyPerUnit, String unit) {
        MenuIngredient mi = getById(id);
        if (qtyPerUnit != null) mi.setQtyPerUnit(BigDecimal.valueOf(qtyPerUnit));
        if (unit != null) mi.setUnit(unit);
        return menuIngredientRepository.save(mi);
    }

    // 삭제
    @Transactional
    public String delete(Long id) {
        if (!menuIngredientRepository.existsById(id)) {
            throw new RuntimeException("레시피 항목을 찾을 수 없습니다.");
        }
        menuIngredientRepository.deleteById(id);
        return "레시피 항목 삭제 완료";
>>>>>>> 233f87c (feat: CRUD 완성 및 FoodGuard UI 전면 개선)
    }
}

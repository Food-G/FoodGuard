package com.foodguard.service;

import com.foodguard.entity.Ingredient;
import com.foodguard.entity.Menu;
import com.foodguard.entity.MenuIngredient;
import com.foodguard.repository.IngredientRepository;
import com.foodguard.repository.MenuIngredientRepository;
import com.foodguard.repository.MenuRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
public class MenuIngredientService {

    private final MenuIngredientRepository menuIngredientRepository;
    private final MenuRepository menuRepository;
    private final IngredientRepository ingredientRepository;

    public MenuIngredient add(Long menuId, Long ingredientId, Double qtyPerUnit, String unit, Double tolerance) {
        Menu menu = menuRepository.findById(menuId)
                .orElseThrow(() -> new RuntimeException("메뉴를 찾을 수 없습니다."));
        Ingredient ingredient = ingredientRepository.findById(ingredientId)
                .orElseThrow(() -> new RuntimeException("식자재를 찾을 수 없습니다."));

        MenuIngredient mi = new MenuIngredient();
        mi.setMenu(menu);
        mi.setIngredient(ingredient);
        mi.setQtyPerUnit(BigDecimal.valueOf(qtyPerUnit));
        mi.setUnit(unit);
        mi.setTolerance(BigDecimal.valueOf(tolerance == null ? 0.0 : tolerance));
        return menuIngredientRepository.save(mi);
    }

    public List<MenuIngredient> getByMenu(Long menuId) {
        return menuIngredientRepository.findByMenuId(menuId);
    }

    public void delete(Long id) {
        menuIngredientRepository.deleteById(id);
    }
}

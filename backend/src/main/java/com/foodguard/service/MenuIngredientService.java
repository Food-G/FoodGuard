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
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class MenuIngredientService {

    private final MenuIngredientRepository menuIngredientRepository;
    private final MenuRepository menuRepository;
    private final IngredientRepository ingredientRepository;

    public MenuIngredient add(Long menuId, Long ingredientId, Double qtyPerUnit, String unit) {
        if (qtyPerUnit == null || qtyPerUnit <= 0) throw new RuntimeException("사용량은 0보다 커야 합니다.");
        Menu menu = menuRepository.findById(menuId)                .orElseThrow(() -> new RuntimeException("메뉴를 찾을 수 없습니다."));
        Ingredient ingredient = ingredientRepository.findById(ingredientId)
                .orElseThrow(() -> new RuntimeException("식자재를 찾을 수 없습니다."));

        // 공용 식자재(store 없음)이거나 메뉴와 같은 매장 식자재만
        if (ingredient.getStore() != null && !ingredient.getStore().getId().equals(menu.getStore().getId())) {
            throw new RuntimeException("이 가맹점의 식자재가 아닙니다.");
        }

        if (!MenuAgentService.compatible(unit, ingredient.getUnit())) {
            throw new RuntimeException(ingredient.getName() + "은(는) " + ingredient.getUnit() + " 단위 식자재라 " + unit + "(으)로 쓸 수 없습니다.");
        }
        // 같은 식자재를 두 번 넣으면 재고가 두 번 차감된다. 사용량을 바꾼다
        MenuIngredient mi = menuIngredientRepository.findByMenuId(menuId).stream()
                .filter(x -> x.getIngredient().getId().equals(ingredientId)).findFirst().orElseGet(MenuIngredient::new);
        mi.setMenu(menu);
        mi.setIngredient(ingredient);
        mi.setQtyPerUnit(BigDecimal.valueOf(qtyPerUnit));
        mi.setUnit(unit);
        return menuIngredientRepository.save(mi);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getByStore(Long storeId) {
        return menuIngredientRepository.findActiveByStore(storeId).stream().map(mi -> Map.<String, Object>of(
                "id", mi.getId(),
                "menuId", mi.getMenu().getId(),
                "ingredientId", mi.getIngredient().getId(),
                "ingredientName", mi.getIngredient().getName(),
                "baseUnit", mi.getIngredient().getUnit(),
                "qtyPerUnit", mi.getQtyPerUnit(),
                "unit", mi.getUnit())).toList();
    }

    public List<MenuIngredient> getByMenu(Long menuId) {        return menuIngredientRepository.findByMenuId(menuId);
    }

    public void delete(Long id) {
        menuIngredientRepository.deleteById(id);
    }}

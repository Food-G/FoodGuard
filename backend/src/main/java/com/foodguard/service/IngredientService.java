package com.foodguard.service;

import com.foodguard.security.AuthUser;
import com.foodguard.security.StoreAccess;
import com.foodguard.entity.Ingredient;
import com.foodguard.entity.Store;
import com.foodguard.repository.IngredientRepository;
import com.foodguard.repository.InventoryRepository;
import com.foodguard.repository.MenuIngredientRepository;
import com.foodguard.repository.OrderRequestRepository;
import com.foodguard.repository.StoreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class IngredientService {

    private final IngredientRepository ingredientRepository;
    private final StoreRepository storeRepository;
    private final MenuIngredientRepository menuIngredientRepository;
    private final InventoryRepository inventoryRepository;
    private final OrderRequestRepository orderRequestRepository;
    private final StoreAccess storeAccess;

    // 식자재 등록
    @Transactional
    public Ingredient create(Long storeId, String name, String category, String unit) {
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new RuntimeException("가맹점을 찾을 수 없습니다."));
        Ingredient ingredient = new Ingredient();
        ingredient.setStore(store);
        ingredient.setName(name);
        ingredient.setCategory(category);
        ingredient.setUnit(unit);
        return ingredientRepository.save(ingredient);
    }

    // 가맹점별 식자재 조회 (store_id 없는 기존 데이터 포함)
    public List<Ingredient> getByStore(Long storeId) {
        return ingredientRepository.findByStoreIdIncludingLegacy(storeId);
    }

    // 식자재 수정
    @Transactional
    public Ingredient update(Long id, String name, String category, String unit,
                             Integer shelfLifeDays, Integer leadTimeDays, Integer orderCycleDays) {
        Ingredient ingredient = ingredientRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("식자재를 찾을 수 없습니다."));
        ingredient.setName(name);
        ingredient.setCategory(category);
        ingredient.setUnit(unit);
        ingredient.setShelfLifeDays(shelfLifeDays);
        ingredient.setLeadTimeDays(leadTimeDays);
        ingredient.setOrderCycleDays(orderCycleDays);
        return ingredientRepository.save(ingredient);
    }

    // 식자재 삭제 (연결 레코드 전부 먼저 삭제: 발주→메뉴구성→재고→식자재)
    @Transactional
    public String delete(Long id) {
        // 공용 식자재를 지우면 다른 매장의 레시피·재고·발주 기록까지 사라진다
        Ingredient target = ingredientRepository.findById(id).orElseThrow(() -> new RuntimeException("식자재를 찾을 수 없습니다."));
        AuthUser user = storeAccess.currentUser();
        if (target.getStore() == null && (user == null || !user.isHqAdmin())) {
            throw new RuntimeException("공용 식자재는 본사만 삭제할 수 있습니다.");
        }
        orderRequestRepository.deleteByIngredientId(id);
        menuIngredientRepository.deleteByIngredientId(id);
        inventoryRepository.deleteByIngredientId(id);
        ingredientRepository.deleteById(id);        return "식자재 삭제 완료";
    }
}
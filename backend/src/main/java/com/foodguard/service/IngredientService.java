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
import com.foodguard.util.UnitConverter;
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
    private final InventoryLedger ledger;

    // 식자재 등록
    @Transactional
    public Ingredient create(Long storeId, String name, String category, String unit) {
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new RuntimeException("가맹점을 찾을 수 없습니다."));
        Ingredient ingredient = new Ingredient();
        ingredient.setStore(store);
        ingredient.setName(name);
        ingredient.setCategory(category);
        ingredient.setUnit(UnitConverter.validateBaseUnit(unit));
        return ingredientRepository.save(ingredient);
    }

    // storeId 없이 부르는 화면용: 점주는 자기 매장(여러 개면 첫 매장), 본사는 매장 없는 공용 식자재로 등록
    @Transactional
    public Ingredient create(String name, String category, String unit) {
        AuthUser user = storeAccess.currentUser();
        if (user != null && !user.isHqAdmin()) {
            List<Store> stores = storeRepository.findByUserId(user.id());
            if (stores.isEmpty()) throw new RuntimeException("등록된 가맹점이 없습니다.");
            return create(stores.get(0).getId(), name, category, unit);
        }
        Ingredient ingredient = new Ingredient();
        ingredient.setName(name);
        ingredient.setCategory(category);
        ingredient.setUnit(UnitConverter.validateBaseUnit(unit));
        return ingredientRepository.save(ingredient);
    }

    // storeId 없이 부르는 화면용: 점주는 자기 매장들이 쓰는 식자재만, 본사는 전체
    @Transactional(readOnly = true)
    public List<Ingredient> getVisible() {
        AuthUser user = storeAccess.currentUser();
        if (user == null || user.isHqAdmin()) return ingredientRepository.findAll();
        java.util.Map<Long, Ingredient> byId = new java.util.LinkedHashMap<>();
        for (Store store : storeRepository.findByUserId(user.id())) {
            for (Ingredient i : ingredientRepository.findByStoreIdIncludingLegacy(store.getId())) byId.putIfAbsent(i.getId(), i);
        }
        return new java.util.ArrayList<>(byId.values());
    }

    static final int MAX_IMAGE_LENGTH = 400_000; // 화면에서 줄여 올리므로 넉넉한 한도 (약 300KB 사진)

    // 사진만 바꾼다. null·빈 값 = 자동 일러스트로 되돌림
    @Transactional
    public Ingredient updateImage(Long id, String imageUrl) {
        Ingredient ingredient = getById(id);
        String v = imageUrl == null || imageUrl.isBlank() ? null : imageUrl;
        if (v != null && !(v.startsWith("icon:") || v.startsWith("data:image/"))) {
            throw new RuntimeException("사진 형식이 올바르지 않습니다.");
        }
        if (v != null && v.length() > MAX_IMAGE_LENGTH) throw new RuntimeException("사진이 너무 큽니다. 더 작은 사진을 골라 주세요.");
        ingredient.setImageUrl(v);
        return ingredientRepository.save(ingredient);
    }

    public Ingredient getById(Long id) {
        return ingredientRepository.findById(id).orElseThrow(() -> new RuntimeException("식자재를 찾을 수 없습니다."));
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
        String newUnit = UnitConverter.validateBaseUnit(unit);
        // kg/L/개 사이 변경은 차원이 바뀌는 것이라, 이미 쌓인 재고 수량과 레시피 사용량이 전부 틀어진다
        if (!newUnit.equals(ingredient.getUnit())
                && (inventoryRepository.existsByIngredientId(id)
                    || !menuIngredientRepository.findByIngredientId(id).isEmpty())) {
            throw new IllegalStateException(
                    "재고나 레시피에 쓰이는 식자재는 단위를 바꿀 수 없습니다 (" + ingredient.getUnit() + " → " + newUnit + ")");
        }
        ingredient.setName(name);
        ingredient.setCategory(category);
        ingredient.setUnit(newUnit);
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
        ledger.recordRemoval(inventoryRepository.findByIngredientId(id), "INGREDIENT", id);
        inventoryRepository.deleteByIngredientId(id);
        ingredientRepository.deleteById(id);
        return "식자재 삭제 완료";
    }
}
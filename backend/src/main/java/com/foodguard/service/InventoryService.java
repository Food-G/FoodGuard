package com.foodguard.service;

import com.foodguard.entity.Ingredient;
import com.foodguard.entity.Inventory;
import com.foodguard.entity.Store;
import com.foodguard.repository.IngredientRepository;
import com.foodguard.repository.InventoryRepository;
import com.foodguard.repository.StoreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
public class InventoryService {

    private final InventoryRepository inventoryRepository;
    private final StoreRepository storeRepository;
    private final IngredientRepository ingredientRepository;
    private final InventoryLedger ledger;

    // 재고 등록
    public Inventory create(Long storeId, Long ingredientId, Double quantity) {
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new RuntimeException("가맹점을 찾을 수 없습니다."));
        Ingredient ingredient = ingredientRepository.findById(ingredientId)
                .orElseThrow(() -> new RuntimeException("식자재를 찾을 수 없습니다."));

        Inventory inventory = ledger.set(store, ingredient, quantity, "ADJUST", "INVENTORY", null);
        inventory.setMinThreshold(BigDecimal.ZERO);  // 기존 동작 유지: 등록(덮어쓰기) 시 임계치 0
        return inventoryRepository.save(inventory);
    }

    // 가맹점 재고 조회
    public List<Inventory> getByStore(Long storeId) {
        return inventoryRepository.findByStoreId(storeId);
    }

    // 재고 수량 수정
    public Inventory update(Long id, Double quantity) {
        Inventory inventory = inventoryRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("재고를 찾을 수 없습니다."));
        return ledger.set(inventory.getStore(), inventory.getIngredient(), quantity, "ADJUST", "INVENTORY", id);
    }

    // 재고 삭제
    @org.springframework.transaction.annotation.Transactional
    public String delete(Long id) {
        inventoryRepository.findById(id).ifPresent(inv -> ledger.recordRemoval(List.of(inv), "INVENTORY", id));
        inventoryRepository.deleteById(id);
        return "재고 삭제 완료";
    }

    // 가맹점 전체 재고 초기화
    @org.springframework.transaction.annotation.Transactional
    public String deleteAll(Long storeId) {
        ledger.recordRemoval(inventoryRepository.findByStoreId(storeId), "INVENTORY", null);
        inventoryRepository.deleteByStoreId(storeId);
        return "전체 재고 초기화 완료";
    }
}
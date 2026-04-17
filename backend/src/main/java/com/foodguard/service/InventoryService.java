package com.foodguard.service;

import com.foodguard.entity.Ingredient;
import com.foodguard.entity.Inventory;
import com.foodguard.entity.Store;
import com.foodguard.repository.IngredientRepository;
import com.foodguard.repository.InventoryRepository;
import com.foodguard.repository.StoreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class InventoryService {

    private final InventoryRepository inventoryRepository;
    private final StoreRepository storeRepository;
    private final IngredientRepository ingredientRepository;

    // 재고 등록
    public Inventory create(Long storeId, Long ingredientId, Double quantity) {
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new RuntimeException("가맹점을 찾을 수 없습니다."));
        Ingredient ingredient = ingredientRepository.findById(ingredientId)
                .orElseThrow(() -> new RuntimeException("식자재를 찾을 수 없습니다."));

        Inventory inventory = new Inventory();
        inventory.setStore(store);
        inventory.setIngredient(ingredient);
        inventory.setQuantity(quantity);
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
        inventory.setQuantity(quantity);
        inventory.setUpdatedAt(LocalDateTime.now());
        return inventoryRepository.save(inventory);
    }

    // 재고 삭제
    public String delete(Long id) {
        inventoryRepository.deleteById(id);
        return "재고 삭제 완료";
    }
}
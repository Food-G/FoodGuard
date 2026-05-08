package com.foodguard.service;

import com.foodguard.entity.Inventory;
import com.foodguard.entity.Store;
import com.foodguard.repository.InventoryRepository;
import com.foodguard.repository.StoreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class InventoryService {

    private final InventoryRepository inventoryRepository;
    private final StoreRepository storeRepository;

    public Inventory create(Long storeId, String ingredientName, String unit,
                            BigDecimal currentStock, BigDecimal thresholdStock, LocalDate expiryDate) {
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new RuntimeException("가맹점을 찾을 수 없습니다."));

        Inventory inventory = new Inventory();
        inventory.setStore(store);
        inventory.setIngredientName(ingredientName);
        inventory.setUnit(unit);
        inventory.setCurrentStock(currentStock);
        inventory.setThresholdStock(thresholdStock);
        inventory.setExpiryDate(expiryDate);
        return inventoryRepository.save(inventory);
    }

    public List<Inventory> getByStore(Long storeId) {
        return inventoryRepository.findByStoreId(storeId);
    }

    public Inventory update(Long id, BigDecimal currentStock, BigDecimal wasteQuantity) {
        Inventory inventory = inventoryRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("재고를 찾을 수 없습니다."));
        inventory.setCurrentStock(currentStock);
        inventory.setWasteQuantity(wasteQuantity);
        return inventoryRepository.save(inventory);
    }

    public String delete(Long id) {
        inventoryRepository.deleteById(id);
        return "재고 삭제 완료";
    }
}

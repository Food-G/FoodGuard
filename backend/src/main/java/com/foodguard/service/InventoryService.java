package com.foodguard.service;

import com.foodguard.entity.Inventory;
import com.foodguard.repository.InventoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class InventoryService {

    private final InventoryRepository inventoryRepository;

    // 가맹점 재고 조회
    @Transactional(readOnly = true)
    public List<Inventory> getByStore(Long storeId) {
        return inventoryRepository.findByStoreId(storeId);
    }

    // 가맹점 전체 재고 삭제
    @Transactional
    public String deleteByStore(Long storeId) {
        inventoryRepository.deleteByStoreId(storeId);
        return "전체 재고 삭제 완료";
    }
}
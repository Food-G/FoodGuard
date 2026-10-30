package com.foodguard.service;

import com.foodguard.entity.Inventory;
import com.foodguard.entity.WasteRecord;
import com.foodguard.repository.InventoryRepository;
import com.foodguard.repository.WasteRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class WasteRecordService {

    private final WasteRecordRepository wasteRecordRepository;
    private final InventoryRepository inventoryRepository;

    // 폐기 기록 + 재고 차감 (body: {storeId, ingredientId, quantity, reason?, wasteDate?})
    @Transactional
    public WasteRecord create(Map<String, Object> body) {
        Long storeId = Long.parseLong(body.get("storeId").toString());
        Long ingredientId = Long.parseLong(body.get("ingredientId").toString());
        double quantity = Double.parseDouble(body.get("quantity").toString());
        if (quantity <= 0) {
            throw new RuntimeException("폐기 수량은 0보다 커야 합니다.");
        }

        Inventory inv = inventoryRepository.findByStoreIdAndIngredientId(storeId, ingredientId)
                .orElseThrow(() -> new RuntimeException("재고에 없는 식자재입니다."));
        double remaining = inv.getCurrentQty().doubleValue() - quantity;
        inv.setCurrentQty(BigDecimal.valueOf(Math.max(0, remaining)));
        inventoryRepository.save(inv);

        WasteRecord record = new WasteRecord();
        record.setStoreId(storeId);
        record.setIngredientId(ingredientId);
        record.setIngredientName(inv.getIngredient().getName());
        record.setQuantity(BigDecimal.valueOf(quantity));
        record.setUnit(inv.getUnit());
        record.setReason(body.get("reason") != null ? body.get("reason").toString() : "EXPIRED");
        record.setWasteDate(body.get("wasteDate") != null
                ? LocalDate.parse(body.get("wasteDate").toString()) : LocalDate.now());
        return wasteRecordRepository.save(record);
    }
}

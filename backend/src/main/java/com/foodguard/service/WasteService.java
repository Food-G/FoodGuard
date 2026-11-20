package com.foodguard.service;

import com.foodguard.entity.Ingredient;
import com.foodguard.entity.Inventory;
import com.foodguard.entity.Store;
import com.foodguard.entity.WasteRecord;
import com.foodguard.repository.IngredientRepository;
import com.foodguard.repository.InventoryRepository;
import com.foodguard.repository.InventoryTxnRepository;
import com.foodguard.repository.StoreRepository;
import com.foodguard.repository.WasteRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.LinkedHashMap;
import java.util.Set;
import java.util.TreeSet;

/** 폐기 기록 (D-4). 재고는 InventoryLedger 로 줄인다 — 유통기한 이른 로트부터 차감되므로 만료분이 먼저 빠진다. */
@Service
@RequiredArgsConstructor
public class WasteService {

    static final Set<String> REASONS = Set.of("EXPIRED", "DAMAGED", "OVERPREP", "OTHER");

    private final WasteRecordRepository wasteRepository;
    private final StoreRepository storeRepository;
    private final IngredientRepository ingredientRepository;
    private final InventoryRepository inventoryRepository;
    private final InventoryTxnRepository txnRepository;
    private final InventoryLedger ledger;

    @Transactional
    public WasteRecord record(Long storeId, Long ingredientId, double quantity, String reason) {
        if (!REASONS.contains(reason)) throw new IllegalStateException("알 수 없는 폐기 사유입니다: " + reason);
        double qty = round2(quantity);
        if (qty <= 0) throw new IllegalStateException("폐기량은 0보다 커야 합니다.");
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new IllegalStateException("가맹점을 찾을 수 없습니다: " + storeId));
        Ingredient ingredient = ingredientRepository.findById(ingredientId)
                .orElseThrow(() -> new IllegalStateException("식자재를 찾을 수 없습니다: " + ingredientId));
        double current = inventoryRepository.findByStoreIdAndIngredientId(storeId, ingredientId)
                .map(Inventory::getCurrentQty).map(BigDecimal::doubleValue).orElse(0.0);
        if (qty > current) {
            throw new IllegalStateException(ingredient.getName() + " 폐기량(" + qty + ")이 현재 재고(" + current + ")보다 많습니다.");
        }

        WasteRecord w = new WasteRecord();
        w.setStoreId(storeId);
        w.setIngredientId(ingredientId);
        w.setIngredientName(ingredient.getName());
        w.setUnit(ingredient.getUnit());
        w.setQty(BigDecimal.valueOf(qty));
        w.setReason(reason);
        w.setWasteDate(LocalDate.now());
        w.setCreatedAt(LocalDateTime.now());
        WasteRecord saved = wasteRepository.save(w);

        ledger.set(store, ingredient, round2(current - qty), "WASTE", "WASTE_RECORD", saved.getId());
        return saved;
    }

    public List<WasteRecord> search(Long storeId, LocalDate from, LocalDate to) {
        return wasteRepository.findByStoreIdAndWasteDateBetweenOrderByWasteDateDescIdDesc(storeId, from, to);
    }

    /**
     * 식자재별 폐기율 = 기간 폐기량 ÷ 기간 입고량 (원장 WASTE / ORDER_DONE 합계, to 는 그날 포함).
     * 단위가 달라 전체 합은 내지 않는다. 입고가 없으면 wasteRate 는 null, 값은 퍼센트(0~).
     */
    public List<Map<String, Object>> wasteRate(Long storeId, LocalDate from, LocalDate to) {
        Map<Long, Double> waste = new HashMap<>();
        Map<Long, Double> received = new HashMap<>();
        for (Object[] row : txnRepository.sumWasteAndReceived(storeId, from.atStartOfDay(), to.plusDays(1).atStartOfDay())) {
            Long ingredientId = (Long) row[0];
            double sum = ((Number) row[2]).doubleValue();
            if ("WASTE".equals(row[1])) waste.put(ingredientId, -sum);
            else received.put(ingredientId, sum);
        }

        Set<Long> ids = new TreeSet<>(waste.keySet());
        ids.addAll(received.keySet());
        Map<Long, Ingredient> ingredients = new HashMap<>();
        ingredientRepository.findAllById(ids).forEach(i -> ingredients.put(i.getId(), i));

        List<Map<String, Object>> rows = new ArrayList<>();
        for (Long id : ids) {
            double w = waste.getOrDefault(id, 0.0);
            double r = received.getOrDefault(id, 0.0);
            Ingredient ing = ingredients.get(id);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("ingredientId", id);
            m.put("ingredientName", ing != null ? ing.getName() : null);
            m.put("unit", ing != null ? ing.getUnit() : null);
            m.put("wasteQty", round2(w));
            m.put("receivedQty", round2(r));
            m.put("wasteRate", r > 0 ? round2(w / r * 100) : null);
            rows.add(m);
        }
        return rows;
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}

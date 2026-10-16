package com.foodguard.service;

import com.foodguard.entity.Inventory;
import com.foodguard.entity.MenuIngredient;
import com.foodguard.entity.PredictionResult;
import com.foodguard.repository.InventoryRepository;
import com.foodguard.util.UnitUtils;
import com.foodguard.repository.MenuIngredientRepository;
import com.foodguard.repository.PredictionResultRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class WastePredictionService {

    private final InventoryRepository inventoryRepository;
    private final PredictionResultRepository predictionResultRepository;
    private final MenuIngredientRepository menuIngredientRepository;

    @Transactional(readOnly = true)
    public List<Map<String, Object>> predict(Long storeId) {
        LocalDate today = LocalDate.now();

        List<Inventory> inventories = inventoryRepository.findByStoreId(storeId);
        List<PredictionResult> predictions = predictionResultRepository
                .findByStore_IdAndPredictionDateGreaterThanEqualOrderByPredictionDateAsc(storeId, today);

        List<Map<String, Object>> result = new ArrayList<>();

        for (Inventory inv : inventories) {
            if (inv.getExpiryDate() == null) continue;
            if (inv.getExpiryDate().isBefore(today)) continue;

            Long ingId = inv.getIngredient().getId();
            LocalDate expiryDate = inv.getExpiryDate();
            long daysUntilExpiry = ChronoUnit.DAYS.between(today, expiryDate);

            double expectedConsumption = 0;
            for (PredictionResult p : predictions) {
                if (!p.getPredictionDate().isAfter(expiryDate)) {
                    for (MenuIngredient mi : menuIngredientRepository.findByMenuId(p.getMenu().getId())) {
                        if (mi.getIngredient().getId().equals(ingId)) {
                            double rawQty = mi.getQtyPerUnit().doubleValue() * p.getPredictedQty();
                            expectedConsumption += convertToBaseUnit(rawQty, mi.getUnit(), inv.getIngredient().getUnit());
                        }
                    }
                }
            }

            double currentQty = inv.getCurrentQty().doubleValue();
            double wastePrediction = Math.max(0, round1(currentQty - expectedConsumption));
            double wasteRate = currentQty > 0 ? Math.round(wastePrediction / currentQty * 1000.0) / 10.0 : 0;

            Map<String, Object> item = new LinkedHashMap<>();
            item.put("inventoryId", inv.getId());
            item.put("ingredientId", ingId);
            item.put("ingredientName", inv.getIngredient().getName());
            item.put("currentQty", currentQty);
            item.put("unit", inv.getUnit());
            item.put("expiryDate", expiryDate.toString());
            item.put("daysUntilExpiry", daysUntilExpiry);
            item.put("expectedConsumption", round1(expectedConsumption));
            item.put("wastePrediction", wastePrediction);
            item.put("wasteRate", wasteRate);
            result.add(item);
        }

        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> summary(Long storeId) {
        List<Map<String, Object>> items = predict(storeId);
        double totalWaste = items.stream()
                .mapToDouble(i -> ((Number) i.get("wastePrediction")).doubleValue())
                .sum();
        long wasteCount = items.stream()
                .filter(i -> ((Number) i.get("wastePrediction")).doubleValue() > 0)
                .count();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalItems", items.size());
        result.put("wasteCount", wasteCount);
        result.put("totalWasteQty", round1(totalWaste));
        result.put("items", items);
        return result;
    }

    private double convertToBaseUnit(double qty, String recipeUnit, String baseUnit) {
        return UnitUtils.convertToBaseUnit(qty, recipeUnit, baseUnit);
    }

    private double round1(double v) {
        return UnitUtils.round1(v);
    }
}
